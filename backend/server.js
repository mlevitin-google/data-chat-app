// server.js (Node.js with Express)
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { GoogleAIFileManager } = require("@google/generative-ai/server");
const dotenv = require('dotenv');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto'); // Added for session ID generation

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
const app = express();
const port = 3001;

// Response and file caching
const responseCache = new Map();
let cachedFiles = null;

// Session management
const userSessions = new Map(); // Store chat history for each user

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

// Define file paths
const dataFilePaths = {
    h1_2025: "/Users/mlevitin/Desktop/data-explorer/data-chat-app/backend/[CG&E DM&A Ops Pillar] 2025.H1 VMAXX Responses + Backend Data - H1 2025 Raw Data.csv",
    h2_2024: "/Users/mlevitin/Desktop/data-explorer/data-chat-app/backend/[CG&E DM&A Ops Pillar] 2025.H1 VMAXX Responses + Backend Data - H2 2024 Raw Data.csv"
};

// Helper function to upload file to Gemini
async function uploadToGemini(filePath, mimeType) {
    try {
        console.log(`Attempting to upload file: ${filePath}`);

        // Check if file exists
        try {
            await fs.access(filePath);
        } catch (err) {
            throw new Error(`File does not exist at path: ${filePath}`);
        }

        // Upload file
        const uploadResult = await fileManager.uploadFile(
            filePath,
            {
                mimeType: mimeType,
                displayName: path.basename(filePath),
            }
        );

        console.log(`Uploaded file ${uploadResult.file.displayName} as: ${uploadResult.file.name}`);
        return uploadResult.file;
    } catch (error) {
        console.error("Error in uploadToGemini:", error);
        throw error;
    }
}

// Helper function to wait for files to be processed
async function waitForFilesActive(files) {
    console.log("Waiting for file processing...");
    for (const name of files.map((file) => file.name)) {
        let file = await fileManager.getFile(name);
        while (file.state === "PROCESSING") {
            process.stdout.write(".");
            await new Promise((resolve) => setTimeout(resolve, 2000));
            file = await fileManager.getFile(name);
        }
        if (file.state !== "ACTIVE") {
            throw new Error(`File ${file.name} failed to process`);
        }
    }
    console.log("...all files ready");
}

// Generate a unique session ID
function generateSessionId() {
    return crypto.randomBytes(16).toString("hex");
}

// Main endpoint for asking questions
app.post('/ask-question', async (req, res) => {
    console.log("Request body:", req.body);
    if (!req.body.question) {
        console.error("Question is missing from the request body");
        return res.status(400).json({ error: "Question is required" });
    }
    
    try {
        const userQuestion = req.body.question;
        let sessionId = req.body.sessionId; // Retrieve session ID from request
        console.log(`Processing question: "${userQuestion}" with session ID: ${sessionId}`);

        // If no session ID is provided, create a new one
        if (!sessionId) {
            sessionId = generateSessionId();
            console.log(`Generated new session ID: ${sessionId}`);
        }

        // Normalize the question for caching
        const normalizedQuestion = userQuestion.trim().toLowerCase();

        // Check cache for exact question match (within the session)
        const sessionCacheKey = `${sessionId}-${normalizedQuestion}`;
        if (responseCache.has(sessionCacheKey)) {
            console.log("Returning cached response (session-specific)");
            return res.json({ answer: responseCache.get(sessionCacheKey), sessionId: sessionId });
        }

        // Upload files if not already cached
        if (!cachedFiles) {
            console.log("Uploading files for the first time...");
            try {
                const file1 = await uploadToGemini(dataFilePaths.h1_2025, 'text/csv');
                const file2 = await uploadToGemini(dataFilePaths.h2_2024, 'text/csv');

                const files = [file1, file2];
                await waitForFilesActive(files);

                cachedFiles = files;
                console.log("Files uploaded and cached successfully");
            } catch (error) {
                console.error("Error uploading files:", error);
                throw new Error(`File upload error: ${error.message}`);
            }
        }

        // Define system instruction
        const systemInstruction = `
            *** ONLY USE DATA FROM THE UNDERLYING DATASETS. DO NOT USE OTHER INFORMATION IN YOUR ANALYSIS ***

            Role and Purpose:

                * You are an analyst on the CG&E sector team tasked with understanding insights from large datasets.
                * You will use the Hopper's Hub data, which provides the DM&A (likely Data, Measurement, and Analytics) team with metrics based on the VMAXX strategy.
                * Your goal is to help CG&E teams understand their clients' data, tech, and measurement maturity.
                * This tool facilitates effective business planning, promotes knowledge sharing, and ensures a unified perspective.

                Behaviors and Rules:

                1) Data Interpretation:
                    a) Analyze the Hopper's Hub data to identify key insights and trends related to client maturity.
                    b) Clearly explain the meaning and implications of various metrics and data points.
                    c) Connect data insights to the VMAXX strategy and its goals.

                2) Client Understanding:
                    a) Help CG&E teams understand their clients' current state in terms of data, technology, and measurement.
                    b) Identify areas where clients can improve their maturity and achieve better results.
                    c) Translate complex data concepts into clear and actionable recommendations for clients.

                3) Business Planning:
                    a) Use data insights to inform business planning and decision-making for CG&E teams.
                    b) Provide data-driven recommendations for resource allocation, strategy development, and project prioritization.
                    c) Help teams align their activities with the overall VMAXX strategy and business goals.

                4) Knowledge Sharing:
                    a) Share insights and best practices with CG&E teams to promote knowledge sharing and collaboration.
                    b) Facilitate discussions and workshops to help teams understand and utilize the Hopper's Hub data effectively.
                    c) Create clear and concise reports and presentations to communicate key findings to stakeholders.

                Tone and Style:

                * Maintain a professional and analytical tone.
                * Use clear and concise language, avoiding jargon or technical terms when possible.
                * Be objective and data-driven in your analysis and recommendations.
                * Focus on providing actionable insights that can help CG&E teams achieve their goals.
                
                *** ONLY USE DATA FROM THE UNDERLYING DATASETS. DO NOT USE OTHER INFORMATION IN YOUR ANALYSIS ***
        `;

        console.log(`Starting chat session with Gemini...`);

        // Create generative model - using the same model as in the sample code
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-pro-exp-02-05",  // Updated model name
            systemInstruction: systemInstruction,
        });

        const generationConfig = {
            temperature: 1,  // Updated to match sample
            topP: .95,
            topK: 40,
            maxOutputTokens: 8192,
            responseMimeType: "text/plain",  // Explicitly set response type
        };

        // Retrieve chat history for the current session
        let chatHistory = userSessions.get(sessionId) || [];

        try {
            // Initialize chat session if it doesn't exist
            if (!chatHistory.length) {
                console.log("Creating new chat session with initial file data");
                
                // Start with file data in history (this matches the sample code approach)
                const initialHistory = [
                    {
                        role: "user",
                        parts: [
                            {
                                fileData: {
                                    mimeType: cachedFiles[0].mimeType,
                                    fileUri: cachedFiles[0].uri,
                                }
                            },
                            {
                                fileData: {
                                    mimeType: cachedFiles[1].mimeType,
                                    fileUri: cachedFiles[1].uri,
                                }
                            }
                        ]
                    },
                    // You could add the initial model response here if you want
                ];
                
                chatHistory = initialHistory;
            }
            
            // Create chat session with history
            console.log("Setting up chat session with history");
            const chatSession = model.startChat({
                generationConfig,
                history: chatHistory,
            });

            // Send the user's question
            console.log("Sending message to Gemini...");
            const result = await chatSession.sendMessage(userQuestion);
            
            const responseText = result.response.text();
            console.log("Received Gemini response");
            console.log("Raw Gemini Response:\n", responseText);

            // Update chat history with the latest question and response
            chatHistory.push({ 
                role: "user", 
                parts: [{ text: userQuestion }]
            });
            
            chatHistory.push({ 
                role: "model", 
                parts: [{ text: responseText }]
            });
            
            // Store the updated chat history in the userSessions map
            userSessions.set(sessionId, chatHistory);
            
            // Save response to cache (session-specific)
            responseCache.set(sessionCacheKey, responseText);

            // Send response
            res.json({ answer: responseText, sessionId: sessionId });

        } catch (error) {
            console.error("Error generating content:", error);
            return res.status(500).json({ error: "Error generating content", details: error.message });
        }

    } catch (error) {
        console.error("Error processing question:", error);
        res.status(500).json({
            error: "Failed to process the question",
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            sessionId: req.body.sessionId // Return the session ID even in error case
        });
    }
});

// Add a route to clear the cache if needed
app.post('/clear-cache', (req, res) => {
    responseCache.clear();
    cachedFiles = null;
    userSessions.clear(); // Clear all session data
    res.json({ message: "Cache and session data cleared successfully" });
});

// Add endpoint to retrieve session history (for debugging)
app.get('/session-history/:sessionId', (req, res) => {
    const sessionId = req.params.sessionId;
    const history = userSessions.get(sessionId) || [];
    res.json({ sessionId, history });
});

app.listen(port, () => {
    console.log(`Data analysis server running on port ${port}`);
});