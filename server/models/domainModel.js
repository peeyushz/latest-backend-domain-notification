"use strict";
const mongoose = require('mongoose');

var schema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
    },
    planId: {
        type: String,
        required: true,
    },
    domain: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: true
    },
    isExpired: {
        type: Boolean,
        required: true
    },
    expiryDate: {
        type: Number,
        required: true
    },
    alertTime: {
        type: String,
        required: true
    },
    alerts: {
        type: Array,
        required: true
    },
    createdAt: {
        type: String,
        default: new Date()
    },
    updatedAt: {
        type: String,
        default: new Date()
    }
})

const domainModel = mongoose.model('domain', schema);

module.exports = domainModel;