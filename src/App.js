import React, { useState, useRef, useEffect } from 'react';
import { Button, Grid, Paper, Typography, Box, CircularProgress, TextField, createTheme, ThemeProvider } from '@mui/material';
import { Send } from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Papa from 'papaparse';
//import { GoogleGenerativeAI, HarmCategory } from "@google/generative-ai";
import { GoogleGenerativeAI, HarmCategory } from "@google/generative-ai";
import data1 from './data/h12025.csv';
import data2 from './data/h22024.csv';

// Get API key from environment variable
// IMPORTANT: In your .env file, prefix with REACT_APP_ for React to access it
const API_KEY = process.env.REACT_APP_GEMINI_API_KEY || 'AIzaSyBmC_WFCdfdV-Bj_6i_EEwri5je6d4M3pE';

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(API_KEY, {
    harmCategories: [HarmCategory.HARM_CATEGORY_UNSPECIFIED, HarmCategory.HARM_CATEGORY_OTHER]
  });

const theme = createTheme({
    palette: {
        primary: {
            main: '#64B5F6',
        },
        secondary: {
            main: '#009688',
        },
        background: {
            default: '#F5F5F5',
        },
        text: {
            primary: '#424242',
        },
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    backgroundColor: '#64B5F6',
                    color: 'white',
                    '&:hover': {
                        backgroundColor: '#1E88E5',
                    },
                },
            },
        },
    },
});

const DataChatApp = () => {
    const [csvFile, setCsvFile] = useState(null);
    const [dataStats1, setDataStats1] = useState(null);
    const [dataStats2, setDataStats2] = useState(null);
    const [jsonData1, setJsonData1] = useState(null);
    const [jsonData2, setJsonData2] = useState(null);
    const [summary, setSummary] = useState('');
    const [chatHistory, setChatHistory] = useState([]);
    const [currentQuestion, setCurrentQuestion] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const chatContainerRef = useRef(null);
    const [conversationHistory, setConversationHistory] = useState([]);
    const [sessionId, setSessionId] = useState(null);

    useEffect(() => {
      const savedSessionId = localStorage.getItem('sessionId');
      if (savedSessionId) {
        setSessionId(savedSessionId);
      } else {
        const newSessionId = genAI.generateSessionId();
        setSessionId(newSessionId);
        localStorage.setItem('sessionId', newSessionId);
      }
    }, []);
    const [sessionHistory, setSessionHistory] = useState([]);

    // Helper function to compute data statistics

    // Helper function to compute data statistics
    const computeDataStats = (data) => {
        if (!data || data.length === 0) return null;

        const columnNames = Object.keys(data[0]);
        const rowCount = data.length;
        const colCount = columnNames.length;

        // Calculate data types and sample values for each column
        const columnStats = {};
        columnNames.forEach(col => {
            // Get non-null values
            const nonNullValues = data
                .map(row => row[col])
                .filter(val => val !== null && val !== undefined && val !== '');

            // Determine type
            let type = 'unknown';
            if (nonNullValues.length > 0) {
                if (nonNullValues.every(val => !isNaN(val) && val !== '')) type = 'number';
                else if (nonNullValues.every(val => val === 'true' || val === 'false')) type = 'boolean';
                else if (nonNullValues.every(val => !isNaN(Date.parse(val)))) type = 'date';
                else type = 'string';
            }

            // Calculate numeric stats if applicable
            let numericStats = {};
            if (type === 'number') {
                const numericValues = nonNullValues.map(v => Number(v));
                numericStats = {
                    min: Math.min(...numericValues),
                    max: Math.max(...numericValues),
                    avg: numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length
                };
            }

            // For string columns, get unique values and their counts if not too many
            let categoryInfo = {};
            if (type === 'string') {
                const uniqueValues = [...new Set(nonNullValues)];
                if (uniqueValues.length <= 50) { // Only store if reasonable number of categories
                    const valueCounts = {};
                    nonNullValues.forEach(val => {
                        valueCounts[val] = (valueCounts[val] || 0) + 1;
                    });
                    categoryInfo = {
                        uniqueValueCount: uniqueValues.length,
                        valueCounts: valueCounts
                    };
                } else {
                    categoryInfo = {
                        uniqueValueCount: uniqueValues.length
                    };
                }
            }

            // Get sample values (up to 5)
            const sampleValues = nonNullValues.slice(0, 5);

            columnStats[col] = {
                type,
                nonNullCount: nonNullValues.length,
                nullCount: rowCount - nonNullValues.length,
                sampleValues,
                ...numericStats,
                ...categoryInfo
            };
        });

        return {
            rowCount,
            colCount,
            columnNames,
            columnStats
        };
    };

    const parseCSVData = async (csvData) => {
        return new Promise((resolve, reject) => {
            Papa.parse(csvData, {
                header: true,
                dynamicTyping: true,
                complete: (results) => {
                    if (results.data && results.data.length > 0) {
                        // Filter out empty rows that PapaParse sometimes includes
                        const cleanData = results.data.filter(row =>
                            Object.values(row).some(val => val !== null && val !== '')
                        );
                        resolve(cleanData);
                    } else {
                        reject("No data parsed from CSV.");
                    }
                },
                error: (error) => {
                    reject(error);
                }
            });
        });
    };

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const response1 = await fetch(data1);
                const text1 = await response1.text();
                const parsedData1 = await parseCSVData(text1);
                setJsonData1(parsedData1);
                setDataStats1(computeDataStats(parsedData1));
                
                const response2 = await fetch(data2);
                const text2 = await response2.text();
                const parsedData2 = await parseCSVData(text2);
                setJsonData2(parsedData2);
                setDataStats2(computeDataStats(parsedData2));

                console.log("Data1 stats:", computeDataStats(parsedData1));
                console.log("Data2 stats:", computeDataStats(parsedData2));

                // Load conversation history from localStorage if available
                const savedHistory = localStorage.getItem('chatHistory');
                if (savedHistory) {
                    setChatHistory(JSON.parse(savedHistory));
                }

                const savedConversation = localStorage.getItem('conversationHistory');
                if (savedConversation) {
                    setConversationHistory(JSON.parse(savedConversation));
                }
                 const savedHistorySession = localStorage.getItem('sessionHistory');
                if (savedHistorySession) {
                    setSessionHistory(JSON.parse(savedHistorySession));
                }
            } catch (error) {
                console.error("Error loading initial data:", error);
                setJsonData1(null);
                setDataStats1(null);
                setJsonData2(null);
                setDataStats2(null);
            }
        };

        loadInitialData();
    }, []);

    // Save chat history to localStorage whenever it changes
    useEffect(() => {
        if (chatHistory.length > 0) {
            localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
        }
    }, [chatHistory]);

    // Save conversation history to localStorage whenever it changes
    useEffect(() => {
        if (conversationHistory.length > 0) {
            localStorage.setItem('conversationHistory', JSON.stringify(conversationHistory));
        }
    }, [conversationHistory]);

    const resetState = () => {
        setCsvFile(null);
        setSummary('');
        setChatHistory([]);
        setConversationHistory([]);
        
        // Clear localStorage
        localStorage.removeItem('chatHistory');
        localStorage.removeItem('conversationHistory');
    };

    const handleSendQuestion = async () => {
        if (!currentQuestion.trim()) return;

        setIsProcessing(true);
        const userQuestion = currentQuestion.trim();
        setChatHistory(prev => [...prev, { role: 'user', message: userQuestion }]);
        setCurrentQuestion('');

        try {
            // Prepare data context for the AI
            let dataContext = "";
            
            if (jsonData1 && dataStats1) {
                dataContext += `Dataset 1 (H1 2025):\n`;
                dataContext += `- Rows: ${dataStats1.rowCount}\n`;
                dataContext += `- Columns: ${dataStats1.colCount}\n`;
                dataContext += `- Column Names: ${dataStats1.columnNames.join(', ')}\n\n`;
                
                // Include a sample of the data (first 20 rows)
                dataContext += `Sample data from Dataset 1:\n`;
                dataContext += JSON.stringify(jsonData1.slice(0, 20), null, 2) + "\n\n";
            }
            
            if (jsonData2 && dataStats2) {
                dataContext += `Dataset 2 (H2 2024):\n`;
                dataContext += `- Rows: ${dataStats2.rowCount}\n`;
                dataContext += `- Columns: ${dataStats2.colCount}\n`;
                dataContext += `- Column Names: ${dataStats2.columnNames.join(', ')}\n\n`;
                
                // Include a sample of the data (first 20 rows)
                dataContext += `Sample data from Dataset 2:\n`;
                dataContext += JSON.stringify(jsonData2.slice(0, 20), null, 2) + "\n\n";
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

            // Initialize the model
            const model = genAI.getGenerativeModel({
                model: "gemini-1.5-pro",
                systemInstruction: systemInstruction,
            });

            // Create a chat session
            const chat = model.startChat({
                history: conversationHistory.map(item => ({
                    role: item.role,
                    parts: [{ text: item.text }]
                })),
                generationConfig: {
                    temperature: 1,
                    topP: .95,
                    topK: 40,
                    maxOutputTokens: 8192,
                }
            });
            const chatSessionId = genAI.generateSessionId();
            setSessionId(chatSessionId);
            localStorage.setItem('sessionId', JSON.stringify(chatSessionId));

            // Add data context to the conversation if it's the first message
            let fullPrompt = userQuestion;
            if (conversationHistory.length === 0) {
                fullPrompt = `Here is the data context I'll be working with:\n\n${dataContext}\n\nNow, to answer your question: ${userQuestion}`;
            }

            // Send message to Gemini
            const result = await chat.sendMessage(fullPrompt);
            const responseText = result.response.text();
            // Update chat history for UI
            setChatHistory(prev => [...prev, { 
                role: 'gemini', 
                message: responseText 
            }]);

            // Update conversation history for Gemini context
            setConversationHistory(prev => [
                ...prev,
                { role: "user", text: fullPrompt },
                { role: "model", text: responseText }
            ]);
            const currentHistory = localStorage.getItem('sessionHistory');
            if(currentHistory){
                setSessionHistory(JSON.parse(currentHistory));
            }
            const history = sessionHistory;
            if (history.length > 0) {
                localStorage.setItem('sessionHistory', JSON.stringify(history));
            }

            // Update chat history for UI
            setChatHistory(prev => [...prev, { 
                role: 'gemini', 
                message: responseText 
            }]);

            // Update conversation history for Gemini context
            setConversationHistory(prev => [
                ...prev,
                { role: "user", text: fullPrompt },
                { role: "model", text: responseText }
            ]);

        } catch (error) {
            console.error("Error answering question:", error);
            setChatHistory(prev => [...prev, {
                role: 'gemini',
                message: "Sorry, I couldn't process your question. This may be due to the dataset size or an unexpected API response. Please try again or rephrase your question."
            }]);
        } finally {
            setIsProcessing(false);
        }
    };

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatHistory]);

    const handleClearChat = () => {
        setChatHistory([]);
        setConversationHistory([]);
        localStorage.removeItem('chatHistory');
        localStorage.removeItem('conversationHistory');
        localStorage.removeItem('sessionId');
        localStorage.removeItem('sessionHistory')
    };

    return (
        <ThemeProvider theme={theme}>
            <Grid container spacing={2} sx={{
                backgroundColor: 'background.default',
                color: 'text.primary',
                p: 4,
                justifyContent: 'center',
                maxWidth: '80vw',
                minHeight: '100vh'
            }}>
                <Grid item xs={12} md={3} sx={{ p: 2 }}>
                    <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2 }}>Data Chat</Typography>

                    {(dataStats1 || dataStats2) && (
                        <Paper elevation={3} sx={{ p: 2, mb: 3, backgroundColor: '#CFD8DC' }}>
                            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>Dataset Info</Typography>
                            <Typography>Rows 1: {dataStats1?.rowCount || 'N/A'}</Typography>
                            <Typography>Columns 1: {dataStats1?.colCount || 'N/A'}</Typography>

                            <Typography>Rows 2: {dataStats2?.rowCount || 'N/A'}</Typography>
                            <Typography>Columns 2: {dataStats2?.colCount || 'N/A'}</Typography>
                        </Paper>
                    )}

                    {summary && (
                        <Paper elevation={3} sx={{ p: 2, backgroundColor: '#CFD8DC' }}>
                            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>Summary</Typography>
                            <Box sx={{ maxHeight: '300px', overflowY: 'auto' }}>
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
                            </Box>
                        </Paper>
                    )}
                    <Button
                        variant="outlined"
                        color="primary"
                        onClick={handleClearChat}
                        disabled={isProcessing}
                        sx={{ mt: 2, mb: 2 }}
                    >
                        Clear Chat
                    </Button>
                </Grid>

                <Grid item xs={12} md={9} sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '90vh' }}>
                    <Paper elevation={3} sx={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        p: 2,
                        backgroundColor: '#ECEFF1',
                        mb: 2,
                        overflow: 'hidden'
                    }}>
                        <Typography variant="h6" sx={{ mb: 2 }}>Chat with Your Data</Typography>

                        <Box
                            sx={{
                                flex: 1,
                                overflowY: 'auto',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 2,
                                p: 1
                            }}
                            ref={chatContainerRef}
                        >
                            {chatHistory.length === 0 && (
                                <Paper elevation={1} sx={{ p: 2, bgcolor: '#E8EAF6', alignSelf: 'center', maxWidth: '80%' }}>
                                    <Typography variant="body1">
                                        Welcome to Hoppers Hub AI! Feel free to ask me questions about the data from the H2 2024 and H1 2025 Hopper's Hub reports
                                    </Typography>
                                </Paper>
                            )}

                            {chatHistory.map((message, index) => (
                                <Paper
                                    key={index}
                                    elevation={1}
                                    sx={{
                                        p: 2,
                                        borderRadius: 2,
                                        maxWidth: '75%',
                                        alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                                        backgroundColor: message.role === 'user' ? '#BBDEFB' : '#E8F5E9',
                                    }}
                                >
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.message}</ReactMarkdown>
                                </Paper>
                            ))}

                            {isProcessing && (
                                <Paper elevation={1} sx={{
                                    p: 2,
                                    borderRadius: 2,
                                    alignSelf: 'flex-start',
                                    backgroundColor: '#E0E0E0',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}>
                                    <CircularProgress size={20} sx={{ mr: 1 }} />
                                    <Typography>Processing...</Typography>
                                </Paper>
                            )}
                        </Box>
                    </Paper>

                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <TextField
                            value={currentQuestion}
                            onChange={(e) => setCurrentQuestion(e.target.value)}
                            placeholder="Ask a question about your data..."
                            fullWidth
                            variant="outlined"
                            disabled={isProcessing || (!jsonData1 && !jsonData2)}
                            sx={{ bgcolor: 'white' }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendQuestion();
                                }
                            }}
                        />
                        <Button
                            onClick={handleSendQuestion}
                            disabled={isProcessing || !currentQuestion.trim() || (!jsonData1 && !jsonData2)}
                            variant="contained"
                            sx={{ whiteSpace: 'nowrap' }}
                        >
                            <Send sx={{ mr: 1 }} />
                            Send
                        </Button>
                    </Box>
                </Grid>
            </Grid>
        </ThemeProvider>
    );
};

export default DataChatApp;