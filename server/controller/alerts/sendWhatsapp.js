// Download the helper library from https://www.twilio.com/docs/node/install
// Set environment variables for your credentials
// Read more at http://twil.io/secure
const dotenv = require("dotenv");
dotenv.config();

const accountSid = "SK7a7a6bb2d4fbcf9ea8c4692bfa670e72";
const authToken = "b8f2df4bb8a7b81c323858255add7a15";
const client = require("twilio")(accountSid, authToken);

client.messages
  .create({ body: "Hello from Twilio", from: "whatsapp:+12542563465", to: "whatsapp:+917790999344" })
  .then(message => console.log(message.sid));