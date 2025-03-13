// server.js (Node.js with Express)
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
const { GoogleAIFileManager } = require("@google/generative-ai/server");
const dotenv = require('dotenv');
const fs = require('fs').promises; // Use promises version for async/await
const path = require('path');

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
const app = express();
const port = 3001;

// Add response cache
const responseCache = new Map();

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit, just in case
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey); // Initialize fileManager

// Define file paths (centralized for easier maintenance)
const dataFilePaths = {
  h1_2025: "/Users/mlevitin/Desktop/data-explorer/data-chat-app/backend/[CG&E DM&A Ops Pillar] 2025.H1 VMAXX Responses + Backend Data - H1 2025 Raw Data.csv",
  h2_2024: "/Users/mlevitin/Desktop/data-explorer/data-chat-app/backend/[CG&E DM&A Ops Pillar] 2025.H1 VMAXX Responses + Backend Data - H2 2024 Raw Data.csv"
};

async function uploadToGemini(filePath, mimeType) {
    try {
        console.log(`Attempting to upload file: ${filePath}`);
        
        // Check if file exists before trying to read it
        try {
            await fs.access(filePath);
            console.log(`File exists at: ${filePath}`);
        } catch (err) {
            throw new Error(`File does not exist at path: ${filePath}. Error: ${err.message}`);
        }
        
        // Upload using the correct API format
        const uploadResult = await fileManager.uploadFile(
            filePath,
            {
                mimeType: mimeType,
                displayName: path.basename(filePath),
            }
        );
        
        const file = uploadResult.file;
        console.log(`Uploaded file ${file.displayName} as: ${file.name}`);
        return file;
    } catch (error) {
        console.error("Error in uploadToGemini:", error);
        throw error; // Re-throw to be caught higher up
    }
}

//The following function is to ensure files are ready before generating prompts
async function waitForFilesActive(files) {
    console.log("Waiting for file processing...");
    for (const name of files.map((file) => file.name)) {
        let file = await fileManager.getFile(name);
        while (file.state === "PROCESSING") {
            process.stdout.write(".")
            await new Promise((resolve) => setTimeout(resolve, 5000));  // Check every 5 seconds, as API has request limits.
            file = await fileManager.getFile(name)
        }
        if (file.state !== "ACTIVE") {
            throw new Error(`File ${file.name} failed to process`);
        }
    }
    console.log("...all files ready\n");
}

app.post('/ask-question', async (req, res) => {
    try {
        const userQuestion = req.body.question;
        console.log(`Processing question: "${userQuestion}"`);
        
        // Check cache for exact question match
        const normalizedQuestion = userQuestion.trim().toLowerCase();
        if (responseCache.has(normalizedQuestion)) {
            console.log("Returning cached response");
            return res.json({ answer: responseCache.get(normalizedQuestion) });
        }

        // Use cached file references if available
        let file1, file2;
        if (global.cachedFiles) {
            console.log("Using cached file references");
            [file1, file2] = global.cachedFiles;
        } else {
            // Upload files and cache them for future use
            console.log("Starting file uploads...");
            try {
                file1 = await uploadToGemini(dataFilePaths.h1_2025, 'text/csv');
                file2 = await uploadToGemini(dataFilePaths.h2_2024, 'text/csv');
                
                const files = [file1, file2];
                await waitForFilesActive(files);
                
                // Cache for future requests
                global.cachedFiles = files;
                console.log("Files uploaded and cached successfully");
            } catch (error) {
                console.error("Error uploading files:", error);
                throw new Error(`File upload/processing error: ${error.message}`);
            }
        }

        // Start the chat session with improved system instruction
        console.log("Starting chat session with Gemini...");
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash", // Use a stable production model
            systemInstruction: `
                You are a data analysis assistant for Hoppers Hub that provides precise, deterministic answers based on the provided datasets.
                For numerical questions:
                - Always calculate exact values using the same methodology
                - Return only the final number with up to 2 decimal places for averages
                - Document your calculation method to ensure consistency
                - Be deterministic - the same question should always yield the same answer
                
                For the datasets provided:
                - H1 2025 data is in the first file
                - H2 2024 data is in the second file
                - When evaluating aggregate metrics, ensure you're using the correct time period
            `,
        });

        const generationConfig = {
            temperature: 0.2, // Set to 0 for deterministic answers
            topP: .95,      // Set to 1.0 for deterministic answers
            topK: 40,        // Lower value for more consistent responses
            maxOutputTokens: 8192,
        };

        const chatSession = model.startChat({
            generationConfig,
            history: [] // Clear the chat history
        });

        // Send the question with improved prompt formatting
        console.log("Sending message to Gemini with file references...");
        const result = await chatSession.sendMessage([
            {
                fileData: {
                    mimeType: file1.mimeType,
                    fileUri: file1.uri,
                },
            },
            {
                fileData: {
                    mimeType: file2.mimeType,
                    fileUri: file2.uri,
                },
            },
            { 
                text: `${userQuestion}
                
                Important: If this is a calculation question, show your calculation method and ensure you would get the same result if asked this question again. For average calculations, round to 2 decimal places.`
            },
        ]);

        const responseText = result.response.text();
        console.log("Received Gemini response successfully");
        
        // For numerical results, try to extract just the number for consistency
        let finalResponse = responseText;
        if (userQuestion.toLowerCase().includes("average") || 
            userQuestion.toLowerCase().includes("mean") ||
            userQuestion.toLowerCase().includes("median") ||
            userQuestion.toLowerCase().includes("sum") ||
            userQuestion.toLowerCase().includes("count")) {
            
            // Try to extract just the numerical answer for consistent display
            const numberMatch = responseText.match(/\b\d+(\.\d+)?\b/);
            if (numberMatch) {
                const extractedNumber = parseFloat(numberMatch[0]);
                // Format to 2 decimal places for consistency
                finalResponse = extractedNumber.toFixed(2);
            }
        }
        
        // Save response to cache before sending
        responseCache.set(normalizedQuestion, finalResponse);
        res.json({ answer: finalResponse });

    } catch (error) {
        console.error("Error processing question:", error);
        console.error(error.stack); // Log the stack trace for more details
        res.status(500).json({ 
            error: "Failed to process the question", 
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }); // Send error details
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});