import React, { useState, useRef, useEffect } from 'react';
import { Button, Grid, Paper, Typography, Box, CircularProgress, TextField, createTheme, ThemeProvider } from '@mui/material';
import { Send } from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Papa from 'papaparse';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Get API key from environment variable
const API_KEY = process.env.REACT_APP_GEMINI_API_KEY;

// Initialize Gemini
const genAI = new GoogleGenerativeAI(API_KEY);

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
    const [chatHistory, setChatHistory] = useState([]);
    const [currentQuestion, setCurrentQuestion] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const chatContainerRef = useRef(null);
    const [csvText1, setCsvText1] = useState(''); // Store raw CSV text
    const [csvText2, setCsvText2] = useState('');
    const [dataStats1, setDataStats1] = useState(null);
    const [dataStats2, setDataStats2] = useState(null);


    // --- File Loading (Client-Side) ---
    // We no longer parse immediately.  We store the raw text.

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


    useEffect(() => {
        const loadData = async () => {
            try {
                // Load CSV data as text
                let loadedCsvText1, loadedCsvText2;

                try {
                    const response = await fetch('http://localhost:3001/api/files'); //Add semicolon

                    const files = await response.json();

                    loadedCsvText1 = files[0].text;
                    loadedCsvText2 = files[2].text;

                    setCsvText1(loadedCsvText1);
                    setCsvText2(loadedCsvText2); //Add semicolon
                }
                catch (error) {
                    console.error("Error loading files:", error);
                }

                //parse for the stats
                const parsedData1 = Papa.parse(loadedCsvText1, { header: true, dynamicTyping: true }).data;
                const parsedData2 = Papa.parse(loadedCsvText2, { header: true, dynamicTyping: true }).data;
                setDataStats1(computeDataStats(parsedData1));
                setDataStats2(computeDataStats(parsedData2));

            } catch (error) { // Outer catch block added!
                console.error("Error loading or parsing CSV data:", error);
            }
        };

        loadData();

        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, []); // Empty dependency array


    const handleSendQuestion = async () => {
        if (!currentQuestion.trim() || !chatHistory || !csvText1 || !csvText2) {
            console.error("Not ready to send:", { currentQuestion, chatHistory, csvText1, csvText2 });
            return;
        }

        setIsProcessing(true);
        setChatHistory(prev => [...prev, { role: 'user', message: currentQuestion.trim() }]);
        setCurrentQuestion('');

        try {
            const response = await fetch('http://localhost:3001/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: currentQuestion.trim(), history: chatHistory.map(item => ({
                        role: item.role === 'user' ? 'user' : 'model', // Correct roles for Gemini
                        parts: [{ text: item.message }] // Correct structure
                    })), dataContext: `
        Here is the content of the first CSV file (H1 2025):
        \`\`\`csv
        ${csvText1}
        \`\`\`

        Here is the content of the second CSV file (H2 2024):
        \`\`\`csv
        ${csvText2}
        \`\`\`
      `, systemInstruction: `
            *** ONLY USE DATA FROM THE UNDERLYING DATASETS. DO NOT USE OTHER INFORMATION IN YOUR ANALYSIS ***

            Role and Purpose:

                * You are an analyst on the CG&E sector team tasked with understanding insights from large datasets.
                * Currently, the provided datasets (H1 2025 and H2 2024) contain HTML content related to a create-react-app setup and do not include meaningful performance data for client maturity analysis.
                * Your goal is to acknowledge the nature of the current data and inform the user that meaningful analysis cannot be performed until relevant performance data is provided.

            Behaviors and Rules:

            1) Data Assessment:
                a) Recognize that the current datasets contain HTML structure and lack performance metrics needed for maturity analysis.
                b) Do not attempt to extract insights related to client maturity from the HTML content.

            2) User Communication:
                a) Clearly communicate to the user that the current data is not suitable for the intended analytical tasks.
                b) Explain that performance data related to client maturity (e.g., data, technology, measurement metrics) is required for meaningful analysis.
                c) If the user asks specific questions about potential future data, you can provide general information based on your training, but clearly state that this is speculative until the actual data is available.

            Tone and Style:

                * Maintain a professional and informative tone.
                * Use clear and concise language.
                * Be direct about the limitations of the current data.
                * Offer to assist further once relevant data is available.

            *** ONLY USE DATA FROM THE UNDERLYING DATASETS. DO NOT USE OTHER INFORMATION IN YOUR ANALYSIS ***
        `
        }),
            });
            if (response.ok) {
                const responseText = await response.text()
                setChatHistory(prev => [...prev, { role: 'gemini', message: responseText }]);
            }
            else {
                setChatHistory(prev => [...prev, { role: 'gemini', message: "Sorry, I encountered an error." }]);
            }
        }
        catch (error) {
            console.error("Error sending message:", error);
            setChatHistory(prev => [...prev, { role: 'gemini', message: "Sorry, I encountered an error." }]);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleClearChat = () => {
        setChatHistory([]);
        // No need to reset model or chatSession; just clear history.
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
                            disabled={isProcessing || !csvText1 || !csvText2}
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
                            disabled={isProcessing || !currentQuestion.trim() || !csvText1 || !csvText2}
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