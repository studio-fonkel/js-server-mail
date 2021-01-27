var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var settings = require('./settings.json');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// CORS.
app.all('/send-mail', function(request, response, next) {
    response.header("Access-Control-Allow-Origin", "*");
    response.header("Access-Control-Allow-Headers", "Content-Type");
    next();
});

app.get('/send-mail', function(request, response) {
    response.send('Status 200: Mailscript OK');
});

// The API route.
app.post('/send-mail', function(request, response) {
    if (settings[request.headers.origin]) {
        var mailInfo = settings[request.headers.origin];
        var className = mailInfo.mail_service + "Mailer";
        var mailer = new mailerTypes[className](mailInfo.options);
        var input = request.body;

        var inputObject = createInputObject(input);
        var bodyText = createBodyText(input);

        var functions = []

        mailInfo.emails.forEach(function (mailItem) {
            var mailBody = '';

            if (mailItem.headerText) {
                mailBody += mailItem.headerText + "\n\n";
            }

            mailBody += bodyText + "\n";

            if (mailItem.footerText) {
                mailBody += mailItem.footerText;
            }

            var email = {
                subject: mailItem.subject,
                body: mailBody,
                from: mailItem.from
            };

            if (mailItem.replyToField) { email.replyTo = inputObject[mailItem.replyToField] }
            else { email.replyTo = mailItem.replyTo }

            if (mailItem.fromNameField) { email.fromName = inputObject[mailItem.fromNameField] }
            else { email.fromName = mailItem.fromName }

            if (mailItem.toField) { email.to = [inputObject[mailItem.toField]] }
            else { email.to = mailItem.to }

            mailer.send(email);
        });

        response.send({
            success: true
        });
    }
    else {
        response.status(400).send({
            error: "Site is not allowed to sent email via me."
        });
    }
});

var createInputObject = function (inputArray) {
    var inputObject = {}
    inputArray.forEach(function (object) {
        inputObject[object.label] = object.value;
    });
    return inputObject;
}

var createBodyText = function (values) {
    var output = '';
    values.forEach(function (object) {
        output += object.label + ': ' + object.value + "\n";
    });
    return output;
}

app.listen(3017);
console.log('Yo server is running on 3017')

var mailerTypes = {};

mailerTypes.mandrillMailer = function (options) {
    this.mandrill = require('mandrill-api/mandrill');
    this.client = new this.mandrill.Mandrill(options.key);

    this.send = function (message) {
        var newTos = [];
        message.to.forEach(function (toItem) {
            newTos.push({
                "email": toItem,
                "name": toItem,
                "type": "to"
            });
        });

        message.to = newTos;
        message.from_name = message.fromName;
        message.from_email = message.from;
        message.text = message.body;

        this.client.messages.send({
            "message": message
        }, function(result) {
            console.log(result);
        }, function(e) {
            return {
                error: 'A mandrill error occurred: ' + e.name + ' - ' + e.message
            }
        });
    }
};

mailerTypes.sparkpostMailer = function (options) {
    var that = this;
    this.SparkPost = require('sparkpost');
    this.client = new this.SparkPost(options.key);

    this.send = function (message) {
        var newTos = [];
        message.to.forEach(function (toItem) {
            newTos.push({ "address": toItem });
        });

        var transmissionBody = {
          recipients: newTos
        }

        if (options.template_id) {
          var htmlText = message.body.replace(/\n/g, '<br>');

          transmissionBody['content'] = {
            template_id: options.template_id
          }
          transmissionBody['substitution_data'] = {
            from: message.from,
            subject: message.subject,
            text: htmlText
          }
        }
        else {
          transmissionBody['content'] = {
            from: message.from,
            subject: message.subject,
            text: message.body,
          }
        }

        that.client.transmissions.send({
            transmissionBody
        }, function(err, res) {
            if (err) {
                console.log(err)
                return {
                    error: err
                }
            }
            else {
                console.log({
                    sucsess: message
                })
                return {
                    succsess: true
                }
            }
        });
    }
};
