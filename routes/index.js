/**
 * Recieve a POST from Amazon SNS
 */

function parse_mesage(sns) {
  ret = {
    "type": "",
    "message": ""
  };
  console.log(sns.Message);
  if ( sns.Message.indexOf("AWSAccountId") > -1 ){
    // from cloudwatch
    var json_message = JSON.parse(sns.Message);
    ret["type"] = json_message.NewStateValue;
    ret["message"] = json_message.AlarmDescription + " " + json_message.NewStateReason;
  }
  else{
    // from monit
    console.log(sns.Subject);
    msg = sns.Subject.split(':');
    ret["type"] = msg[0];
    server = msg[1].split(' - ');
    ret["message"] = server[2];
  }
  console.log(ret);
  return ret;
}

exports.index = function(req, res) {
    var request = require('request');

    var sns = JSON.parse(req.text);
    console.log(req.text);

    if (sns.Type == 'SubscriptionConfirmation') {
        request(sns.SubscribeURL, function (err, result, body) {
            if (err || body.match(/Error/)) {
                console.log("Error subscribing to Amazon SNS Topic", body);
                return res.send('Error', 500);
            }

            console.log("Subscribed to Amazon SNS Topic: " + sns.TopicArn);
            res.send('Ok');
        });
    }
    else if (sns.Type == 'Notification') {
        var message = '';
        var ses_notification = false;
        var payload = {
            "subtype": "bot_message",
            "text": ""
        };

        msg = parse_mesage(sns);
        payload['text'] = sns.Subject + (msg["type"] == "ALARM" ? " <!everyone>": "");
        payload['attachments'] = [
            {
                "fallback": sns.Subject,
                "color": msg["type"] == "ALARM" ? "danger" : "good",
                "fields": [
                    {
                        "title": "Status",
                        "value": msg["type"],
                        "short": true
                    },
                    {
                        "title": "Message",
                        "value": msg["message"],
                        "short": true
                    }
                ]
            }
        ];

        var slackUrl = process.env.SLACK_ENDPOINT;

        if (typeof process.env.SLACK_USERNAME != "undefined") {
            payload["username"] = process.env.SLACK_USERNAME;
        }

        if (typeof process.env.SLACK_ICON != "undefined") {
            payload["icon_emoji"] = process.env.SLACK_ICON;
        }

        if (typeof process.env.SLACK_CHANNEL != "undefined") {
            payload["channel"] = process.env.SLACK_CHANNEL;
        }

        payload["subtype"] = "bot_message";

        console.log("Sending message to Slack", payload['text'], slackUrl);
        request.post(
            slackUrl,
            {
                form: {
                    "payload": JSON.stringify(payload)
                }
            },
            function (err, result, body) {
                if (err) {
                    console.log("Error sending message to Slack", err, slackUrl, body);
                    return res.send('Error', 500);
                }

                console.log("Sent message to Slack", slackUrl);

                res.send('Ok');
            }
        );
    }
};
