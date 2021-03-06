/**
 * This file contains all of the web and hybrid functions for interacting with
 * Ana and the Watson Conversation service. When API calls are not needed, the
 * functions also do basic messaging between the client and the server.
 *
 * @summary   Functions for Ana Chat Bot.
 *
 * @link      cloudco.mybluemix.net
 * @since     0.0.3
 * @requires  app.js
 *
 */
var watson = require('watson-developer-cloud');
var CONVERSATION_NAME = "Conversation-Demo"; // conversation name goes here.
var fs = require('fs');
var appEnv = null;
var conversationWorkspace, conversation;
var request = require('request');
require('dotenv-safe').load();

// =====================================
// CREATE THE SERVICE WRAPPER ==========
// =====================================
// Create the service wrapper
conversation = watson.conversation({
    url: process.env.WATSON_URL,
    username: process.env.WATSON_USER,
    password: process.env.WATSON_PASSWORD,
    version_date: process.env.WATSON_DATE,
    version: process.env.WATSON_VERSION
});
// check if the workspace ID is specified in the environment
conversationWorkspace = process.env.WATSON_WS;
// if not, look it up by name or create one
// Allow clients to interact

var chatbot = {

    sendMessage : function (req, callback) {

        buildContextObject(req, function (err, params) {

            if (err) {
                console.log("Error in building the parameters object : ", err);
                return callback(err);
            }

            if (params.message) {

                var conv = req.body.context.conversation_id;
                var context = req.body.context;
                var res = {
                    intents: [],
                    entities: [],
                    input: req.body.text,
                    output: {
                        text: params.message
                    },
                    context: context
                };

                callback(null, res);

            } else if (params) {

                //Send message to the conversation service with the current context
                conversation.message(params, function (err, data) {

                    if (err) {
                        console.log("Error in sending message: ", err);
                        return callback(err);

                    } else {

                        var conv = data.context.conversation_id;
                        //console.log("Got response from Ana: ", JSON.stringify(data));

                        //insere logs da conversação no cloudant
                        //insertLogs(req,params,data);
                        return callback(null, data);
                    }
                });
            }
        });

    }
};

function insertLogs(req,params,data){

    var USER_DATA = {
        "conversation_id": data.context.conversation_id,
        "messageWatson": data.output.text[0],
        "messageUser": data.input.text,
        "aplicacao": "abrale"
    }

    if (data.intents.length > 0) {
        USER_DATA.intencao = data.intents[0].intent;
        console.log('Detected intent: #' + data.intents[0].intent);
    }

    var fullUrl = req.protocol + '://' + 'xpersocial-logunchidden-underlineman.mybluemix.net'
    var options = {
        method: 'POST',
        uri: fullUrl+'/api/logs',
        headers: {
            'Content-Type': 'application/json'
        },
        json: USER_DATA
    };

    //salvar logs no banco
    request(options, callbackLog);
}

function callbackLog(error, response, body) {

    if (!error) {
        var info = JSON.parse(JSON.stringify(body));
        //console.log(info);
    }
    else {
        console.log('Error - xperSocial - insertLogs: ' + error);
    }
}

// ===============================================
// LOG MANAGEMENT FOR USER INPUT FOR ANA =========
// ===============================================
function chatLogs(owner, conversation, response, callback) {

    console.log("Response object is: ", response);

    //Blank log file to parse down the response object
    var logFile = {
        inputText: '',
        responseText: '',
        entities: {},
        intents: {}
    };

    logFile.inputText = response.input.text;
    logFile.responseText = response.output.text;
    logFile.entities = response.entities;
    logFile.intents = response.intents;
    logFile.date = new Date();
    var date = new Date();
    var doc = {};

    Logs.find({selector: {'conversation': conversation}}, function (err, result) {

        if (err) {
            console.log("Couldn't find logs.");
            callback(null);

        } else {

            doc = result.docs[0];

            if (result.docs.length === 0) {

                console.log("No log. Creating new one.");
                doc = {
                    owner: owner,
                    date: date,
                    conversation: conversation,
                    lastContext: response.context,
                    logs: []
                };

                doc.logs.push(logFile);

                Logs.insert(doc, function (err, body) {
                    if (err) {
                        console.log("There was an error creating the log: ", err);
                    } else {
                        console.log("Log successfull created: ", body);
                    }

                    callback(null);
                });

            } else {

                doc.lastContext = response.context;
                doc.logs.push(logFile);

                Logs.insert(doc, function (err, body) {
                    if (err) {
                        console.log("There was an error updating the log: ", err);
                    } else {
                        console.log("Log successfull updated: ", body);
                    }

                    callback(null);
                });
            }
        }
    });
}
// ===============================================
// UTILITY FUNCTIONS FOR CHATBOT AND LOGS ========
// ===============================================
/**
 * @summary Form the parameter object to be sent to the service
 *
 * Update the context object based on the user state in the conversation and
 * the existence of variables.
 *
 * @function buildContextObject
 * @param {Object} req - Req by user sent in POST with session and user message
 */
function buildContextObject(req, callback) {

    var message = req.body.text;
    var context;

    if (!message) {
        message = '';
    }

    var params = {
        workspace_id: conversationWorkspace,
        input: {},
        context: {}
    };

    if (req.body.context) {
        context = req.body.context;
        params.context = context;

    } else {
        context = '';
    }

    params.input = {
        text: message // User defined text to be sent to service
    };

    return callback(null, params);
}

module.exports = chatbot;
