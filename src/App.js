import React, { useState, useRef, useEffect } from 'react';
import { Button, Grid, Paper, Typography, Box, CircularProgress, TextField, createTheme, ThemeProvider } from '@mui/material';
import { Send, UploadFile } from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Papa from 'papaparse';
import data1 from './[CG&E DM&A Ops Pillar] 2025.H1 VMAXX Responses + Backend Data - H1 2025 Raw Data.csv';
import data2 from './[CG&E DM&A Ops Pillar] 2025.H1 VMAXX Responses + Backend Data - H2 2024 Raw Data.csv';

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
    //const apiKey = process.env.REACT_APP_GEMINI_API_KEY;  // REMOVE THIS LINE. API KEY must not be in the frontend
     const backendUrl = "http://localhost:3001"; //CHANGE to your backend url

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
                if (nonNullValues.every(val => typeof val === 'number')) type = 'number';
                else if (nonNullValues.every(val => typeof val === 'boolean')) type = 'boolean';
                else if (nonNullValues.every(val => !isNaN(Date.parse(val)))) type = 'date';
                else type = 'string';
            }
            
            // Calculate numeric stats if applicable
            let numericStats = {};
            if (type === 'number') {
                numericStats = {
                    min: Math.min(...nonNullValues),
                    max: Math.max(...nonNullValues),
                    avg: nonNullValues.reduce((sum, val) => sum + val, 0) / nonNullValues.length
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
                const parsedData1 = await parseCSVData(data1);
                const parsedData2 = await parseCSVData(data2);

                setJsonData1(parsedData1);
                setDataStats1(computeDataStats(parsedData1));

                setJsonData2(parsedData2);
                setDataStats2(computeDataStats(parsedData2));

                console.log("Data1 stats:", computeDataStats(parsedData1));
                console.log("Data2 stats:", computeDataStats(parsedData2));

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

    const handleFileUpload = (event) => {
        const file = event.target.files?.[0];
        if (file) {
            setCsvFile(file);
            const reader = new FileReader();
            reader.onload = async (e) => {
                const content = e.target?.result;
                if (typeof content === 'string') {
                    Papa.parse(content, {
                        header: true,
                        dynamicTyping: true,
                        complete: (results) => {
                            if (results.data && results.data.length > 0) {
                                // Filter out empty rows that PapaParse sometimes includes
                                const cleanData = results.data.filter(row => 
                                    Object.values(row).some(val => val !== null && val !== '')
                                );
                                
                                setJsonData1(cleanData);
                                setDataStats1(computeDataStats(cleanData));
                                
                                console.log("Parsed data stats:", computeDataStats(cleanData));
                                console.log("Sample (first 2 rows):", cleanData.slice(0, 2));
                            } else {
                                setJsonData1(null);
                                setDataStats1(null);
                                console.error("No data parsed from CSV.");
                            }
                        },
                        error: (error) => {
                            setJsonData1(null);
                            setDataStats1(null);
                            console.error("Error parsing CSV:", error);
                        }
                    });
                }
            };
            reader.readAsText(file);
        } else {
            resetState();
        }
    };
    
    const resetState = () => {
        setCsvFile(null);
        setJsonData1(null);
        setDataStats1(null);
        setJsonData2(null);
        setDataStats2(null);
        setSummary('');
    };

    const summarizeData = async () => {
       //This code does nothing in the project
        if ((!jsonData1 || !dataStats1) && (!jsonData2 || !dataStats2)) return;

        setIsProcessing(true);
        try {
            let prompt = ``;
            if (jsonData1 && dataStats1) {
                const sampleData1 = jsonData1.slice(0, Math.min(100, jsonData1.length));

                prompt += `Dataset 1 (H1 2025) Statistics:\n`;
                prompt += `- Rows: ${dataStats1.rowCount}\n`;
                prompt += `- Columns: ${dataStats1.colCount}\n`;
                prompt += `- Column Names: ${dataStats1.columnNames.join(', ')}\n\n`;

                prompt += `Here's a sample of the first few rows of Dataset 1:\n`;
                prompt += `\`\`\`json\n${JSON.stringify(sampleData1.slice(0, 5), null, 2)}\n\`\`\`\n\n`;
            }

            if (jsonData2 && dataStats2) {
                const sampleData2 = jsonData2.slice(0, Math.min(100, jsonData2.length));

                prompt += `Dataset 2 (H2 2024) Statistics:\n`;
                prompt += `- Rows: ${dataStats2.rowCount}\n`;
                prompt += `- Columns: ${dataStats2.colCount}\n`;
                prompt += `- Column Names: ${dataStats2.columnNames.join(', ')}\n\n`;

                prompt += `Here's a sample of the first few rows of Dataset 2:\n`;
                prompt += `\`\`\`json\n${JSON.stringify(sampleData2.slice(0, 5), null, 2)}\n\`\`\`\n\n`;
            }

            prompt += `Provide a concise summary of each dataset, highlighting the nature and potential insights from each.`;

           console.warn("This summarization function doesn't work at all.") //this has been removed to prevent confusion to future developers

            // const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-pro-exp-02-05:generateContent?key=${apiKey}`, { // THIS CODE DOESN'T WORK

        } catch (error) {
            console.error("Error summarizing data:", error);
            setSummary("Sorry, I couldn't summarize the data.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSendQuestion = async () => {
        if (!currentQuestion.trim()) return;
        
        setIsProcessing(true);
        const userQuestion = currentQuestion.trim();
        setChatHistory(prev => [...prev, { role: 'user', message: userQuestion }]);
        setCurrentQuestion('');

        try {
                console.log("requesting backend"); //check if code actually made it here
            const response = await fetch(`${backendUrl}/ask-question`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ question: userQuestion }), // Send the question to the backend
            });

            const data = await response.json();
              console.log("response", data) //check the response from the backend

            if (data && data.answer) {
                setChatHistory(prev => [...prev, { role: 'gemini', message: data.answer }]);
            } else {
                setChatHistory(prev => [...prev, {
                    role: 'gemini',
                    message: "Sorry, I couldn't process your question."
                }]);
            }
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
                            <Typography>File 1: N/A</Typography>
                            <Typography>Size 1: N/A</Typography>
                            <Typography>Rows 1: {dataStats1?.rowCount || 'N/A'}</Typography>
                            <Typography>Columns 1: {dataStats1?.colCount || 'N/A'}</Typography>

                            <Typography>File 2: N/A</Typography>
                            <Typography>Size 2: N/A</Typography>
                            <Typography>Rows 2: {dataStats2?.rowCount || 'N/A'}</Typography>
                            <Typography>Columns 2: {dataStats2?.colCount || 'N/A'}</Typography>
                            <Button
                                onClick={summarizeData}
                                disabled={isProcessing || (!jsonData1 && !jsonData2)}
                                variant="contained"
                                fullWidth
                                sx={{ mt: 2 }}
                            >
                                {isProcessing ? (
                                    <>
                                        <CircularProgress size={20} sx={{ mr: 1 }} />
                                        Summarizing...
                                    </>
                                ) : (
                                    "Summarize Data"
                                )}
                            </Button>
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