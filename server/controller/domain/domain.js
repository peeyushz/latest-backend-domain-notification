const domainModel = require("../../models/domainModel");
const Validator = require("../../helpers/validators");
const keccakHelper = require("keccak");
const axios = require("axios");
const mongoose = require("mongoose");
const Web3 = require("web3");
const web3 = new Web3(Web3.givenProvider || "https://eth.llamarpc.com");
const planPurchaseModel = require("../../models/planPurchaseModel");
var dotenv = require("dotenv");
const userModel = require("../../models/userModel");
const ObjectId = mongoose.Types.ObjectId;
dotenv.config();

const network = "mainnet";

exports.fetchDomainData = async (req, res) => {
    try {
        let data = Validator.checkValidation(req.query);
        if (data["success"] === true) {
            data = data["data"];
        } else {
            res.status(201).send({ success: false, msg: "Missing field", data: {}, errors: "" });
        }
        if (data) {
            const domainData = await domainModel.findOne({ _id: ObjectId(data.domainId) });
            if (domainData !== null) {
                res.status(200).send({ success: true, msg: "Sucessfully fetched data", data: domainData, errors: "" });
            }
        } else {
            return res.status(203).send({ success: false, msg: "Something went wrong ! Please try again later", data: "", errors: "" });
        }
    } catch (error) {
        res.status(500).send({ success: false, msg: "Error", data: {}, errors: error });
    }
};

exports.deleteDomainData = async (req, res) => {
    try {
        let data = Validator.checkValidation(req.query);
        if (data["success"] === true) {
            data = data["data"];
        } else {
            res.status(201).send({ success: false, msg: "Missing field", data: {}, errors: "" });
        }
        if (data) {
            await domainModel.deleteMany({ _id: ObjectId(data.domainId) });
            res.status(200).send({ success: true, msg: "Sucessfully deleted data", data: {}, errors: "" });
        } else {
            return res.status(203).send({ success: false, msg: "Something went wrong ! Please try again later", data: "", errors: "" });
        }
    } catch (error) {
        res.status(500).send({ success: false, msg: "Error", data: {}, errors: error });
    }
};

exports.getDomainData = async (req, res) => {
    try {
        const domainData = await domainModel.find({ userId: req.user.id });
        if (domainData !== null) {
            res.status(200).send({ success: true, msg: "Data fetched successfully", data: domainData });
        } else {
            res.status(203).send({ success: false, msg: "There was some error in fetching data", data: {}, errors: error });
        }
    } catch (error) {
        res.status(500).send({ success: false, msg: "Error", data: {}, errors: error });
    }
};

exports.saveDomainData = async (req, res) => {
    const domainExists = await domainModel.find({domain: req.body.domain}).countDocuments()
    if(domainExists===0){
        const receivedData = req.body;
        if (receivedData.domain.includes("/") || receivedData.domain.includes(":")) {
            res.status(206).send({ success: false, msg: "Invalid ENS Domain", data: "", errors: "" });
        } else {
            const address = await web3.eth.ens.getAddress(receivedData.domain);
            const userData = await userModel.findOne({ _id: ObjectId(req.user.id) });
            const planDetails = await planPurchaseModel.findOne({ userId: ObjectId(userData._id) });
            if (userData && planDetails) {
                let data = {
                    contract: process.env.ENS_CONTRACT_MAINNET,
                    labelHash: keccakHelper("keccak256").update(receivedData.domain.split(".")[0]).digest("hex"),
                };
                axios
                    .get(`https://metadata.ens.domains/${network}/${process.env.ENS_CONTRACT_MAINNET}/${"0x" + data.labelHash}`)
                    .then((response) => {
                        data["isExpired"] = false;
                        data["domain"] = response.data.name;
                        data["address"] = address;
                        data["expiryDate"] = response.data.attributes.filter((attribs) => attribs.trait_type === "Expiration Date")[0].value;
                        {
                            const newDomainData = new domainModel({
                                userId: userData._id,
                                planId: planDetails._id,
                                domain: data.domain,
                                address: data.address,
                                isExpired: data.isExpired,
                                expiryDate: data.expiryDate,
                                alertTime: receivedData.alertTime,
                                alerts: receivedData.alerts,
                            });
                            newDomainData
                                .save(newDomainData)
                                .then((data) => {
                                    res.status(200).send({ success: true, msg: "Data saved sucessfully", data: "", errors: "" });
                                })
                                .catch((err) => {
                                    res.status(206).send({ success: false, msg: "Invalid ENS Domain", data: "", errors: "" });
                                });
                        }
                    })
                    .catch((err) => {
                        res.json({
                            expired: true,
                            message: err.response,
                        });
                    });
            }
        }
    }
    else{
        res.status(206).send({ success: false, msg: "Domain already exists", data: "", errors: "" });
    }
};