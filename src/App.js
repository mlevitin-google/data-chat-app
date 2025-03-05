import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@mui/material';
import { TextField } from '@mui/material';
import { TextareaAutosize } from '@mui/material';
import { CircularProgress } from '@mui/material';
import { Send } from '@mui/icons-material';
// import { cn } from "@/lib/utils" // Ensure this path is correct or remove if not needed

// Mock Gemini API (replace with actual API calls in a real implementation)
const mockGeminiAPI = {
    summarizeCSV: async (csvData) => {
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Mock summary generation
        return "This dataset contains information about customer transactions, including dates, products, and purchase amounts.";
    },
    answerQuestion: async (question, csvData) => {
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Mock response generation based on the question
        if (question.toLowerCase().includes("average")) {
            return "The average purchase amount is $45.20.";
        } else if (question.toLowerCase().includes("most common")) {
            return "The most common product is 'Widget X'.";
        } else {
            return "I'm sorry, I couldn't find specific information about that in the dataset.";
        }
    }
};

const DataChatApp = () => {
    const [csvFile, setCsvFile] = useState(null);
    const [csvData, setCsvData] = useState('');
    const [summary, setSummary] = useState('');
    const [chatHistory, setChatHistory] = useState([]);
    const [currentQuestion, setCurrentQuestion] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const chatContainerRef = useRef(null);

    // Handle file upload
    const handleFileUpload = (event) => {
        const file = event.target.files?.[0];
        if (file) {
            setCsvFile(file);
            // Read the file content
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target?.result;
                if (typeof content === 'string') {
                    setCsvData(content);
                }
            };
            reader.readAsText(file);
        }
    };

    // Summarize the CSV data using Gemini
    const summarizeData = async () => {
        if (!csvData) return;

        setIsProcessing(true);
        try {
            const summaryResult = await mockGeminiAPI.summarizeCSV(csvData);
            setSummary(summaryResult);
        } catch (error) {
            console.error("Error summarizing data:", error);
            setChatHistory(prev => [...prev, { role: 'gemini', message: "Sorry, I couldn't summarize the data." }]);
        } finally {
            setIsProcessing(false);
        }
    };

    // Handle sending a question to Gemini
    const handleSendQuestion = async () => {
        if (!currentQuestion.trim() || !csvData) return;

        setChatHistory(prev => [...prev, { role: 'user', message: currentQuestion }]);
        setCurrentQuestion('');
        setIsProcessing(true);

        try {
            const answer = await mockGeminiAPI.answerQuestion(currentQuestion, csvData);
            setChatHistory(prev => [...prev, { role: 'gemini', message: answer }]);
        } catch (error) {
            console.error("Error answering question:", error);
            setChatHistory(prev => [...prev, { role: 'gemini', message: "Sorry, I couldn't process your question." }]);
        } finally {
            setIsProcessing(false);
        }
    };

    // Scroll to bottom of chat on new message
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatHistory]);

    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col md:flex-row">
            {/* Sidebar for File Upload and Summary */}
            <div className="w-full md:w-1/4 p-4 border-r border-gray-800 space-y-4">
                <h1 className="text-2xl font-bold">Data Chat</h1>
                <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="mb-4"
                    disabled={isProcessing}
                />
                {csvFile && (
                    <div className="p-4 bg-gray-800 rounded-md">
                        <p>File: {csvFile.name}</p>
                        <p>Size: {(csvFile.size / 1024).toFixed(2)} KB</p>
                        <Button
                            onClick={summarizeData}
                            disabled={isProcessing || !csvData}
                            className="mt-4 w-full"
                            variant="contained"
                        >
                            {isProcessing ? (
                                <>
                                    <CircularProgress size={20} className="mr-2" />
                                    Summarizing...
                                </>
                            ) : (
                                "Summarize Data"
                            )}
                        </Button>
                    </div>
                )}
                {summary && (
                    <div className="p-4 bg-gray-800 rounded-md">
                        <h2 className="text-lg font-semibold mb-2">Summary</h2>
                        <p>{summary}</p>
                    </div>
                )}
            </div>

            {/* Chat Interface */}
            <div className="flex-1 p-4 flex flex-col">
                <div
                    className="flex-1 overflow-y-auto space-y-4 mb-4"
                    ref={chatContainerRef}
                >
                    {chatHistory.map((message, index) => (
                        <div
                            key={index}
                            className={`p-3 rounded-lg ${message.role === 'user' ? 'bg-blue-500 text-white ml-auto w-fit max-w-[80%]' : 'bg-gray-800 mr-auto w-fit max-w-[80%]'}`}
                        >
                            {message.message}
                        </div>
                    ))}
                    {isProcessing && (
                        <div className="p-3 bg-gray-800 mr-auto w-fit max-w-[80%]">
                            <CircularProgress size={20} className="mr-2" />
                            Processing...
                        </div>
                    )}
                </div>

                {/* Input Area */}
                <div className="flex items-center gap-2">
                    <TextField
                        value={currentQuestion}
                        onChange={(e) => setCurrentQuestion(e.target.value)}
                        placeholder="Ask a question about the data..."
                        className="flex-1 bg-gray-800 border-gray-700 text-white rounded-md p-3"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendQuestion();
                            }
                        }}
                    />
                    <Button
                        onClick={handleSendQuestion}
                        disabled={isProcessing || !currentQuestion.trim()}
                        className="bg-blue-500 hover:bg-blue-600 text-white"
                        variant="contained"
                    >
                        <Send className="mr-2" />
                        Send
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default DataChatApp;
