// server.js (Node.js with Express)
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { GoogleAIFileManager } = require("@google/generative-ai/server");
const dotenv = require('dotenv');
const fs = require('fs').promises;
const path = require('path');

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
const app = express();
const port = 3001;

// Response and file caching
const responseCache = new Map();
let cachedFiles = null;

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

// Helper function to extract numerical answer from text
function extractNumericalAnswer(text, questionType) {
    // For certain question types, try to extract just the number
    if (questionType === 'numerical') {
        // First try to find a line with "Answer: " followed by a number
        const answerLineMatch = text.match(/Answer:\s*(-?\d+(\.\d+)?)/i);
        if (answerLineMatch) {
            return parseFloat(answerLineMatch[1]).toFixed(2);
        }
        
        // Then try to find any number in the text
        const numberMatch = text.match(/\b(-?\d+(\.\d+)?)\b/);
        if (numberMatch) {
            return parseFloat(numberMatch[1]).toFixed(2);
        }
    }
    
    // Return the full text if we can't extract a number
    return text;
}

// Determine the type of question
function determineQuestionType(question) {
    question = question.toLowerCase();
    
    if (question.includes('average') || 
        question.includes('mean') || 
        question.includes('median') || 
        question.includes('sum') || 
        question.includes('count') ||
        question.includes('total') ||
        question.includes('score')) {
        return 'numerical';
    }
    
    if (question.includes('compare') || 
        question.includes('difference') || 
        question.includes('trend') ||
        question.includes('growth')) {
        return 'analytical';
    }
    
    return 'informational';
}

// Main endpoint for asking questions
app.post('/ask-question', async (req, res) => {
    try {
        const userQuestion = req.body.question;
        console.log(`Processing question: "${userQuestion}"`);
        
        // Normalize the question for caching
        const normalizedQuestion = userQuestion.trim().toLowerCase();
        
        // Check cache for exact question match
        if (responseCache.has(normalizedQuestion)) {
            console.log("Returning cached response");
            return res.json({ answer: responseCache.get(normalizedQuestion) });
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

        // Determine question type to customize the prompt
        const questionType = determineQuestionType(userQuestion);
        
        // Customize system instruction based on question type
        let systemInstruction = `
            You are a specialized data analyst assistant for Hoppers Hub. 
            Your task is to analyze CSV data files and provide precise, accurate answers.
            
            For the datasets provided:
            - H1 2025 data is in the first file
            - H2 2024 data is in the second file
        `;
        
        // Add type-specific instructions
        if (questionType === 'numerical') {
            systemInstruction += `
                For this numerical question:
                - Calculate the exact value with absolute precision
                - Show your calculation steps clearly under "Method:"
                - Provide the final answer numerically under "Answer:"
                - Format numbers with commas for thousands and include up to 2 decimal places
                - Be deterministic - the exact same calculation process every time
                - If asked about scores, look specifically for columns containing 'score' in their name
            `;
        } else if (questionType === 'analytical') {
            systemInstruction += `
                For this analytical question:
                - Provide data-driven insights based on clear evidence
                - Include specific numbers to support your analysis
                - Structure your response with clear sections
                - Focus on key trends and significant differences
            `;
        }
        
        // Initialize Gemini model with custom settings for each question type
        console.log(`Starting chat session with Gemini for ${questionType} question...`);
        
        // Set temperature based on question type
        let temperature = 0.7;
        if (questionType === 'analytical') {
            temperature = 1; // Slight variation allowed for analytical answers
        }
        
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            systemInstruction: systemInstruction,
        });

        const generationConfig = {
            temperature: temperature,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 8192,
            responseMimeType: "text/plain",
        };

        const chatSession = model.startChat({
            generationConfig,
            history: []
        });

        // Create a more specific prompt based on the question type
        let promptText = userQuestion;
        
        if (questionType === 'numerical') {
            promptText = `${userQuestion}
            
            Please structure your response as follows:
            
            Question: (restate the question)
            Method: (show detailed calculation steps)
            Answer: (provide the numerical answer)
            
            If I'm asking about a learning agenda score or any score, make sure to look for columns with "score" in their name, like "maxroi_learning_agenda_score".
            `;
        }

        // Send the question to Gemini
        console.log("Sending message to Gemini with file references...");
        const result = await chatSession.sendMessage([
            {
                fileData: {
                    mimeType: cachedFiles[0].mimeType,
                    fileUri: cachedFiles[0].uri,
                },
            },
            {
                fileData: {
                    mimeType: cachedFiles[1].mimeType,
                    fileUri: cachedFiles[1].uri,
                },
            },
            { text: promptText }
        ]);

        const responseText = result.response.text();
        console.log("Received Gemini response");
        
        // Process the response based on question type
        const finalResponse = extractNumericalAnswer(responseText, questionType);
        
        // Save response to cache
        responseCache.set(normalizedQuestion, finalResponse);
        
        // Send response
        res.json({ answer: finalResponse });

    } catch (error) {
        console.error("Error processing question:", error);
        res.status(500).json({ 
            error: "Failed to process the question", 
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Add a route to clear the cache if needed
app.post('/clear-cache', (req, res) => {
    responseCache.clear();
    cachedFiles = null;
    res.json({ message: "Cache cleared successfully" });
});

app.listen(port, () => {
    console.log(`Data analysis server running on port ${port}`);
});