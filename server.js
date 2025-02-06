require("dotenv").config();
const punycode = require('punycode');
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const cors = require("cors");
const { SessionsClient } = require("@google-cloud/dialogflow"); // Import Dialogflow SDK
const fs = require("fs");

// Load Dialogflow credentials from JSON key file
const CREDENTIALS = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS));

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(bodyParser.json());
app.use(cors());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)

const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => console.log("✅ Connected to MongoDB"));

// Define Schema for Aid Requests
const AidSchema = new mongoose.Schema({
    user_name: String,
    disaster_id: Number,
    aid_amount: Number,
});

const AidRequest = mongoose.model("AidRequest", AidSchema);

// Define Schema for Insurance Claims
const InsuranceSchema = new mongoose.Schema({
    user_name: String,
    policy_number: Number,
    disaster_id: Number,
    damage_type: String,
});

const InsuranceClaim = mongoose.model("InsuranceClaim", InsuranceSchema);

// Create Dialogflow Session Client
const sessionClient = new SessionsClient({ credentials: CREDENTIALS });

// 🔹 Webhook Route for Dialogflow
app.post("/webhook", async (req, res) => {
    const sessionId = req.body.session || "default-session";
    const sessionPath = sessionClient.projectAgentSessionPath(CREDENTIALS.project_id, sessionId);
    const intent = req.body.queryResult.intent.displayName;
    const parameters = req.body.queryResult.parameters;

    console.log(`🔥 Intent: ${intent}`);
    console.log(`📌 Parameters:`, parameters);

    let responseText = "I couldn't process your request. Please try again.";

    try {
        if (intent === "Financial Aid Request") {
            const newAid = new AidRequest({
                user_name: parameters.user_name,
                disaster_id: parameters.disaster_id,
                aid_amount: parameters.aid_amount,
            });
            await newAid.save();
            responseText = `✅ Your aid request for ₹${parameters.aid_amount} has been submitted.`;
        }

        if (intent === "Insurance Claim") {
            const newClaim = new InsuranceClaim({
                user_name: parameters.user_name,
                policy_number: parameters.policy_number,
                disaster_id: parameters.disaster_id,
                damage_type: parameters.damage_type,
            });
            await newClaim.save();
            responseText = `✅ Your insurance claim for ${parameters.damage_type} has been submitted.`;
        }
    } catch (error) {
        console.error("❌ Error processing request:", error);
        responseText = "❌ There was an error processing your request. Please try again later.";
    }

    res.json({ fulfillmentText: responseText });
});

// Start the server
app.listen(PORT, () => console.log(`🚀 Webhook running on port ${PORT}`));