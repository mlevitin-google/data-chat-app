import React, { useState, useRef, useEffect } from 'react';
import { Button, Grid, Paper, Typography, Box, CircularProgress, TextField, createTheme, ThemeProvider } from '@mui/material';
import { Send } from '@mui/icons-material';

const theme = createTheme({
    palette: {
        primary: {
            main: '#64B5F6', // Lighter blue
        },
        secondary: {
            main: '#009688', // Teal
        },
        background: {
            default: '#F5F5F5', // Light gray
        },
        text: {
            primary: '#424242', // Dark gray
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
    const [csvData, setCsvData] = useState('');
    const [summary, setSummary] = useState('');
    const [chatHistory, setChatHistory] = useState([]);
    const [currentQuestion, setCurrentQuestion] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const chatContainerRef = useRef(null);

    const handleFileUpload = (event) => {
        const file = event.target.files?.[0];
        if (file) {
            setCsvFile(file);
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

    const summarizeData = async () => {
        if (!csvData) return;

        setIsProcessing(true);
        try {
            const prompt = `Summarize the following CSV data: ${csvData}`;

            const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: prompt,
                    // Replace with your actual API key
                    key: 'AIzaSyBmC_WFCdfdV-Bj_6i_EEwri5je6d4M3pE',
                }),
            });

            if (!response.ok) {
                // Handle HTTP errors
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result && result.candidates && result.candidates[0] && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts[0]) {
                const summaryResult = result.candidates[0].content.parts[0].text;
                setSummary(summaryResult);
                setChatHistory(prev => [...prev, { role: 'gemini', message: summaryResult }]);
            } else {
                // Handle cases where the expected data structure is not present
                throw new Error('Unexpected API response structure');
            }
        } catch (error) {
            console.error("Error summarizing data:", error);
            setChatHistory(prev => [...prev, { role: 'gemini', message: "Sorry, I couldn't summarize the data." }]);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSendQuestion = async () => {
        if (!currentQuestion.trim() || !csvData) return;

        setChatHistory(prev => [...prev, { role: 'user', message: currentQuestion }]);
        setCurrentQuestion('');
        setIsProcessing(true);

        try {
            const prompt = `CSV data: ${csvData} Question: ${currentQuestion}`;

            const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: prompt,
                    // Replace with your actual API key
                    key: 'AIzaSyBmC_WFCdfdV-Bj_6i_EEwri5je6d4M3pE',
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result && result.candidates && result.candidates[0] && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts[0]) {
                const answer = result.candidates[0].content.parts[0].text;
                setChatHistory(prev => [...prev, { role: 'gemini', message: answer }]);
            } else {
                throw new Error('Unexpected API response structure');
            }
        } catch (error) {
            console.error("Error answering question:", error);
            setChatHistory(prev => [...prev, { role: 'gemini', message: "Sorry, I couldn't process your question." }]);
        } finally {
            setIsProcessing(false);
        }
    };

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatHistory]);

    return (
        <ThemeProvider theme={theme}>
            <Grid container spacing={2} className="min-h-screen" sx={{
                backgroundColor: 'background.default',
                color: 'text.primary',
                p: 4,
                justifyContent: 'center',
                maxWidth: '80vw',
            }}>
                <Grid item xs={12} md={3} className="p-4 border-r border-gray-800 space-y-4">
                    <Typography variant="h5" className="font-bold">Data Chat</Typography>
                    <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        className="mb-4"
                        disabled={isProcessing}
                    />
                    {csvFile && (
                        <Paper elevation={3} className="p-4 rounded-md" sx={{ backgroundColor: '#CFD8DC' }}>
                            <Typography>File: {csvFile.name}</Typography>
                            <Typography>Size: {(csvFile.size / 1024).toFixed(2)} KB</Typography>
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
                        </Paper>
                    )}
                    {summary && (
                        <Paper elevation={3} className="p-4 rounded-md" sx={{ backgroundColor: '#CFD8DC' }}>
                            <Typography variant="h6" className="font-semibold mb-2">Summary</Typography>
                            <Typography>{summary}</Typography>
                        </Paper>
                    )}
                </Grid>

                <Grid item xs={12} md={9} className="p-4 flex flex-col">
                    <Box
                        className="flex-1 overflow-y-auto space-y-4 mb-4"
                        ref={chatContainerRef}
                    >
                        {chatHistory.map((message, index) => (
                            <Paper
                                key={index}
                                elevation={3}
                                className={`p-3 rounded-lg ${message.role === 'user' ? 'ml-auto w-fit max-w-[80%]' : 'mr-auto w-fit max-w-[80%]'}`}
                                sx={{
                                    backgroundColor: message.role === 'user' ? '#BBDEFB' : '#B2DFDB',
                                    color: 'text.primary',
                                }}
                            >
                                {message.message}
                            </Paper>
                        ))}
                        {isProcessing && (
                            <Paper elevation={3} className="p-3 mr-auto w-fit max-w-[80%]" sx={{ backgroundColor: '#CFD8DC' }}>
                                <CircularProgress size={20} className="mr-2" />
                                Processing...
                            </Paper>
                        )}
                    </Box>

                    <Box className="flex items-center gap-2">
                        <TextField
                            value={currentQuestion}
                            onChange={(e) => setCurrentQuestion(e.target.value)}
                            placeholder="Ask a question about the data..."
                            className="flex-1 rounded-md p-3"
                            variant="outlined"
                            InputProps={{
                                className: 'bg-white',
                            }}
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
                            variant="contained"
                        >
                            <Send className="mr-2" />
                            Send
                        </Button>
                    </Box>
                </Grid>
            </Grid>
        </ThemeProvider>
    );
};

export default DataChatApp;
