///////////////////////////////////////////////////////////////////////////
// This class provide CRUD operations on JSON objects collection text file
// with the assumption that each object have an Id member.
// If the objectsFile does not exist it will be created on demand.
/////////////////////////////////////////////////////////////////////
// Author : Nicolas Chourot
// Lionel-Groulx College
/////////////////////////////////////////////////////////////////////

const e = require('express');
const fs = require('fs');
const { type } = require('os');
const utilities = require('../utilities.js');


class Repository {
    constructor(model) {
        this.objectsList = null;
        this.model = model;
        this.objectsName = model.getClassName() + 's';
        this.objectsFile = `./data/${this.objectsName}.json`;
        this.bindExtraDataMethod = null;
        this.updateResult = {
            ok: 0,
            conflict: 1,
            notFound: 2,
            invalid: 3
        }
    }
    setBindExtraDataMethod(bindExtraDataMethod) {
        this.bindExtraDataMethod = bindExtraDataMethod;
    }
    objects() {
        if (this.objectsList == null)
            this.read();
        return this.objectsList;
    }
    read() {
        try {
            let rawdata = fs.readFileSync(this.objectsFile);
            // we assume here that the json data is formatted correctly
            this.objectsList = JSON.parse(rawdata);
        } catch (error) {
            if (error.code === 'ENOENT') {
                // file does not exist, it will be created on demand
                log(FgYellow, `Warning ${this.objectsName} repository does not exist. It will be created on demand`);
                this.objectsList = [];
            } else {
                log(Bright, FgRed, `Error while reading ${this.objectsName} repository`);
                log(Bright, FgRed, '--------------------------------------------------');
                log(Bright, FgRed, error);
            }
        }
    }
    write() {
        fs.writeFileSync(this.objectsFile, JSON.stringify(this.objectsList));
    }
    nextId() {
        let maxId = 0;
        for (let object of this.objects()) {
            if (object.Id > maxId) {
                maxId = object.Id;
            }
        }
        return maxId + 1;
    }
    add(object) {
        try {
            if (this.model.valid(object)) {
                let conflict = false;
                if (this.model.key) {
                    conflict = this.findByField(this.model.key, object[this.model.key]) != null;
                }
                if (!conflict) {
                    object.Id = this.nextId();
                    this.objectsList.push(object);
                    this.write();
                } else {
                    object.conflict = true;
                }
                return object;
            }
            return null;
        } catch (error) {
            console.log(FgRed, `Error adding new item in ${this.objectsName} repository`);
            console.log(FgRed, '-------------------------------------------------------');
            console.log(Bright, FgRed, error);
            return null;
        }
    }
    update(objectToModify) {
        if (this.model.valid(objectToModify)) {
            let conflict = false;
            if (this.model.key) {
                conflict = this.findByField(this.model.key, objectToModify[this.model.key], objectToModify.Id) != null;
            }
            if (!conflict) {
                let index = 0;
                for (let object of this.objects()) {
                    if (object.Id === objectToModify.Id) {
                        this.objectsList[index] = objectToModify;
                        this.write();
                        return this.updateResult.ok;
                    }
                    index++;
                }
                return this.updateResult.notFound;
            } else {
                return this.updateResult.conflict;
            }
        }
        return this.updateResult.invalid;
    }
    remove(id) {
        let index = 0;
        for (let object of this.objects()) {
            if (object.Id === id) {
                this.objectsList.splice(index, 1);
                this.write();
                return true;
            }
            index++;
        }
        return false;
    }
    getAll(params = null) {
        let objectsList = this.objects();
        if (this.bindExtraDataMethod != null) {
            objectsList = this.bindExtraData(objectsList);
        }

        if (params) { // Labo 2 - Vincent Lepage
            objectsList = this.paramsIsArray(objectsList, params);  
            objectsList = this.sortVerificationBeforeCallFunction(objectsList, params);
            objectsList = this.filteredListByNameTitle(objectsList, params);
            objectsList = this.filteredListByCategory(objectsList, params);
        }

        if (objectsList.length == 0)
            objectsList = "No search results found.";

        return objectsList;
    }
    get(id) {
        for (let object of this.objects()) {
            if (object.Id === id) {
                if (this.bindExtraDataMethod != null)
                    return this.bindExtraDataMethod(object);
                else
                    return object;
            }
        }
        return null;
    }
    removeByIndex(indexToDelete) {
        if (indexToDelete.length > 0) {
            utilities.deleteByIndex(this.objects(), indexToDelete);
            this.write();
        }
    }
    findByField(fieldName, value, excludedId = 0) {
        if (fieldName) {
            let index = 0;
            for (let object of this.objects()) {
                try {
                    if (object[fieldName] === value) {
                        if (object.Id != excludedId)
                            return this.objectsList[index];
                    }
                    index++;
                } catch (error) {
                    break;
                }
            }
        }
        return null;
    }

    valueMatch(value, searchValue) {
        try {
            return new RegExp('^' + searchValue.toLowerCase().replace(/\*/g, '.*') + '$').test(value.toString().toLowerCase());
        } catch (error) {
            console.log(error);
            return false;
        }
    }
    compareNum(x, y) {
        if (x === y) return 0;
        else if (x < y) return -1;
        return 1;
    }
    innerCompare(x, y) {
        if ((typeof x) === 'string')
            return x.localeCompare(y);
        else
            return this.compareNum(x, y);
    }
    sortedListWithCompare(objectsList, sort, desc = false) {
        if (desc) {
            if (sort == "name,desc" || sort == "title,desc") {
                if (objectsList[0].Title) {
                    objectsList = [...objectsList].sort((a, b) => this.innerCompare(b.Title, a.Title));
                }
                else if (objectsList[0].Name) {
                    objectsList = [...objectsList].sort((a, b) => this.innerCompare(b.Name, a.Name));
                }
            }
            else if (sort == "category,desc")
                objectsList = [...objectsList].sort((a, b) => this.innerCompare(b.Category, a.Category));
            else
                objectsList = "Error: the parameter 'sort' must to include a name, a title or a category.";
        }
        else {
            if (sort == "name" || sort == "title") {
                if (objectsList[0].Title) {
                    objectsList = [...objectsList].sort((a, b) => this.innerCompare(a.Title, b.Title));
                }
                else if (objectsList[0].Name) {
                    objectsList = [...objectsList].sort((a, b) => this.innerCompare(a.Name, b.Name));
                }
            }
            else if (sort == "category")
                objectsList = [...objectsList].sort((a, b) => this.innerCompare(a.Category, b.Category));
            else
                objectsList = "Error: the parameter 'sort' must to include a name, a title or a category.";
        }
        return objectsList;
    }

    filteredListByNameTitle(objectsList, params)
    {
        let filteredListName = [];
        if (params.Name && Array.isArray(objectsList)) {
            let i = 0;
            let newObjectsList = [];
            if (objectsList[0].Title)
            {
                objectsList.forEach(object => {
                if (this.valueMatch(object.Title, params.Name)) {
                    filteredListName.push(object);
                }});
            }
            else if (objectsList[0].Name)
            {
                objectsList.forEach(object => {
                    if (this.valueMatch(object.Name, params.Name)) {
                        filteredListName.push(object);
                }});
            }
            
            objectsList.forEach(object => {
                filteredListName.forEach(filteredObject => {
                    if (object.Id == filteredObject.Id) {
                        newObjectsList.push(filteredObject);
                    }
                })
            });
            objectsList = newObjectsList;
        }
        return objectsList;
    }

    filteredListByCategory(objectsList, params) {
        let filteredListCategory = [];
        if (params.Category && Array.isArray(objectsList)) {
            let i = 0;
            let newObjectsList = [];
            objectsList.forEach(object => {
                if (this.valueMatch(object.Category, params.Category)) {
                    filteredListCategory.push(object);
                }
            });
            objectsList.forEach(object => {
                filteredListCategory.forEach(filteredObject => {
                    if (object.Id == filteredObject.Id) {
                        newObjectsList.push(filteredObject);
                    }
                })
            });
            objectsList = newObjectsList; 
        }
        return objectsList;
    }

    paramsIsArray(objectsList, params)
    {
        if (Array.isArray(params.sort)) {
            objectsList = "Parameter 'sort' can't be an array. For example: ...?sort=Name&sort=Category";
        }
        else if (Array.isArray(params.Name)) {
            objectsList = "Parameter 'Name' can't be an array. For example: ...?Name=*a&Name=b";
        }
        else if (Array.isArray(params.Category)) {
            objectsList = "Parameter 'Category' can't be an array. For example: ...?Category=ea&Category=*z*";
        }
        else if (Array.isArray(params.Title)) {
            objectsList = "Parameter 'Title' can't be an array. For example: ...?Title=e&Title=*zqw*";
        }
        return objectsList;
    }

    sortVerificationBeforeCallFunction(objectsList, params)
    {
        if (params.sort && Array.isArray(objectsList)) {
            if (params.sort.toLowerCase().includes(',desc'))
                objectsList = this.sortedListWithCompare(objectsList, params.sort.toLowerCase(), true);
            else
                objectsList = this.sortedListWithCompare(objectsList, params.sort.toLowerCase());
        }
        return objectsList;
    }

    
}

module.exports = Repository;