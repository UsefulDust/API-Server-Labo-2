const BookmarkModel = require('../models/bookmark');
const Repository = require('../models/repository');
const path = require('path');
const fs = require('fs');
module.exports =
    class BookmarksController extends require('./Controller') {
        constructor(HttpContext) {
            super(HttpContext, new Repository(new BookmarkModel()));
        }
    }