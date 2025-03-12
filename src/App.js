import React, { useState, useRef, useEffect } from 'react';
import { Button, Grid, Paper, Typography, Box, CircularProgress, TextField, createTheme, ThemeProvider } from '@mui/material';
import { Send, UploadFile } from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Papa from 'papaparse';

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
    const [dataStats, setDataStats] = useState(null);
    const [jsonData, setJsonData] = useState(null);
    const [summary, setSummary] = useState('');
    const [chatHistory, setChatHistory] = useState([]);
    const [currentQuestion, setCurrentQuestion] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const chatContainerRef = useRef(null);
    const apiKey = process.env.REACT_APP_GEMINI_API_KEY;

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
                                
                                setJsonData(cleanData);
                                const stats = computeDataStats(cleanData);
                                setDataStats(stats);
                                
                                console.log("Parsed data stats:", stats);
                                console.log("Sample (first 2 rows):", cleanData.slice(0, 2));
                            } else {
                                setJsonData(null);
                                setDataStats(null);
                                console.error("No data parsed from CSV.");
                            }
                        },
                        error: (error) => {
                            setJsonData(null);
                            setDataStats(null);
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
        setJsonData(null);
        setDataStats(null);
        setSummary('');
    };

    const summarizeData = async () => {
        if (!jsonData || !dataStats) return;

        setIsProcessing(true);
        try {
            // Instead of sending the entire dataset for summarization,
            // send statistics and a sample of the data
            const sampleData = jsonData.slice(0, Math.min(100, jsonData.length));
            
            const prompt = `
            Summarize the following dataset in markdown format using 3-5 bullet points. 
            Focus on the key aspects and insights of the data.
            
            Dataset Statistics:
            - Rows: ${dataStats.rowCount}
            - Columns: ${dataStats.colCount}
            - Column Names: ${dataStats.columnNames.join(', ')}
            
            Column Information:
            ${Object.entries(dataStats.columnStats).map(([col, stats]) => {
                return `- ${col}: ${stats.type} (${stats.nonNullCount}/${dataStats.rowCount} non-null values)
                  ${stats.type === 'number' ? `Range: ${stats.min} to ${stats.max}, Avg: ${stats.avg.toFixed(2)}` : ''}
                  Sample values: ${stats.sampleValues.slice(0, 3).join(', ')}`;
            }).join('\n')}
            
            Here's a sample of the first few rows:
            \`\`\`json
            ${JSON.stringify(sampleData.slice(0, 5), null, 2)}
            \`\`\`
            
            Provide a concise summary that highlights the nature and potential insights from this dataset.
            `;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-pro-exp-02-05:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 300,
                    },
                    safetySettings: [
                        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
                    ],
                }),
            });

            const data = await response.json();
            if (data && data.candidates && data.candidates[0]?.content?.parts?.[0]) {
                const summaryResult = data.candidates[0].content.parts[0].text;
                setSummary(summaryResult);
            } else {
                throw new Error('Unexpected API response structure');
            }
        } catch (error) {
            console.error("Error summarizing data:", error);
            setSummary("Sorry, I couldn't summarize the data.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSendQuestion = async () => {
        if (!currentQuestion.trim() || !jsonData || !dataStats) return;
        
        const userQuestion = currentQuestion.trim();
        setChatHistory(prev => [...prev, { role: 'user', message: userQuestion }]);
        setCurrentQuestion('');
        setIsProcessing(true);
        
        try {
            // Build conversation history for context
            const conversationHistory = chatHistory
                .slice(-6) // Only include the last 3 exchanges (6 messages) for context
                .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.message}`)
                .join('\n');
            
            // Identify key terms in the question to determine the type of analysis needed
            const questionLower = userQuestion.toLowerCase();
            
            // Detect if question is asking for aggregation by group
            const isGroupingQuestion = /by each|for each|per|group by|across|by category|categorize|segment/i.test(questionLower);
            
            // Detect specific aggregation operations
            const needsAverage = /average|avg|mean/i.test(questionLower);
            const needsSum = /sum|total/i.test(questionLower);
            const needsCount = /count|how many|number of/i.test(questionLower);
            const needsMin = /minimum|min|lowest|smallest/i.test(questionLower);
            const needsMax = /maximum|max|highest|largest/i.test(questionLower);
            
            // Detect if question needs full dataset analysis
            const needsFullAnalysis = isGroupingQuestion || needsAverage || needsSum || needsCount || needsMin || needsMax;
            
            // Extract potential column names mentioned in the question
            const potentialColumns = dataStats.columnNames.filter(col => 
                questionLower.includes(col.toLowerCase())
            );
            
            // If the question mentions "score" or similar, try to identify score-related columns
            const scoreRelatedColumns = [];
            if (/score|rating|grade|mark|point/i.test(questionLower)) {
                dataStats.columnNames.forEach(col => {
                    if (/score|rating|grade|mark|point/i.test(col.toLowerCase())) {
                        scoreRelatedColumns.push(col);
                    }
                });
            }
            
            // Try to identify likely grouping columns (categorical data with reasonable cardinality)
            const potentialGroupingColumns = [];
            if (isGroupingQuestion) {
                for (const [col, stats] of Object.entries(dataStats.columnStats)) {
                    if (stats.type === 'string' && stats.uniqueValueCount && 
                        stats.uniqueValueCount > 1 && stats.uniqueValueCount <= 100) {
                        potentialGroupingColumns.push(col);
                    }
                }
            }
            
            let results = {};
            
            // Perform client-side analysis for questions requiring aggregation
            if (needsFullAnalysis) {
                console.log("Performing full dataset analysis...");
                
                // For grouping questions, we need to perform the aggregation for each group
                if (isGroupingQuestion) {
                    // Identify the grouping column - either explicitly mentioned or inferred
                    let groupingColumn = null;
                    
                    // Check if the question mentions a specific column to group by
                    for (const col of potentialGroupingColumns) {
                        if (questionLower.includes(col.toLowerCase())) {
                            groupingColumn = col;
                            break;
                        }
                    }
                    
                    // Look for common grouping terms
                    if (!groupingColumn) {
                        const groupTerms = [
                            { term: "vertical", cols: ["vertical", "department", "division", "business unit"] },
                            { term: "team", cols: ["team", "group", "squad"] },
                            { term: "region", cols: ["region", "location", "geography", "country", "state"] },
                            { term: "category", cols: ["category", "type", "class"] }
                        ];
                        
                        for (const {term, cols} of groupTerms) {
                            if (questionLower.includes(term)) {
                                // Find a column that matches any of the related terms
                                for (const relatedCol of cols) {
                                    const matchingCol = dataStats.columnNames.find(col => 
                                        col.toLowerCase().includes(relatedCol)
                                    );
                                    if (matchingCol) {
                                        groupingColumn = matchingCol;
                                        break;
                                    }
                                }
                                if (groupingColumn) break;
                            }
                        }
                    }
                    
                    // If still not found, use the first potential grouping column
                    if (!groupingColumn && potentialGroupingColumns.length > 0) {
                        groupingColumn = potentialGroupingColumns[0];
                    }
                    
                    // If we have a grouping column, perform the aggregation
                    if (groupingColumn) {
                        // Identify the target columns for aggregation
                        let targetColumns = [];
                        
                        // If specific columns are mentioned in the question, use those
                        if (potentialColumns.length > 0) {
                            targetColumns = potentialColumns.filter(col => 
                                col !== groupingColumn && 
                                dataStats.columnStats[col].type === 'number'
                            );
                        }
                        
                        // If score-related columns are detected and relevant, use those
                        if (targetColumns.length === 0 && scoreRelatedColumns.length > 0) {
                            targetColumns = scoreRelatedColumns;
                        }
                        
                        // If still no target columns, use all numeric columns
                        if (targetColumns.length === 0) {
                            targetColumns = dataStats.columnNames.filter(col => 
                                col !== groupingColumn && 
                                dataStats.columnStats[col].type === 'number'
                            );
                        }
                        
                        // Get all distinct values for the grouping column
                        const groupValues = [...new Set(jsonData.map(row => row[groupingColumn]))].filter(v => v !== null && v !== undefined);
                        
                        // For each group, calculate the requested aggregations for each target column
                        const groupResults = {};
                        
                        for (const groupValue of groupValues) {
                            const groupRows = jsonData.filter(row => row[groupingColumn] === groupValue);
                            
                            if (!groupResults[groupValue]) {
                                groupResults[groupValue] = {
                                    count: groupRows.length
                                };
                            }
                            
                            for (const targetCol of targetColumns) {
                                const numericValues = groupRows
                                    .map(row => row[targetCol])
                                    .filter(val => typeof val === 'number' && !isNaN(val));
                                
                                if (numericValues.length > 0) {
                                    const colResults = {};
                                    
                                    if (needsAverage) {
                                        colResults.average = numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length;
                                    }
                                    
                                    if (needsSum) {
                                        colResults.sum = numericValues.reduce((sum, val) => sum + val, 0);
                                    }
                                    
                                    if (needsCount) {
                                        colResults.count = numericValues.length;
                                    }
                                    
                                    if (needsMin) {
                                        colResults.min = Math.min(...numericValues);
                                    }
                                    
                                    if (needsMax) {
                                        colResults.max = Math.max(...numericValues);
                                    }
                                    
                                    groupResults[groupValue][targetCol] = colResults;
                                }
                            }
                        }
                        
                        results = {
                            type: "groupAggregation",
                            groupingColumn,
                            targetColumns,
                            groups: groupResults,
                            rowsAnalyzed: jsonData.length
                        };
                    }
                } else {
                    // For non-grouping questions, perform direct aggregation on the whole dataset
                    
                    // Identify target columns for aggregation
                    let targetColumns = [];
                    
                    // If specific columns are mentioned in the question, use those
                    if (potentialColumns.length > 0) {
                        targetColumns = potentialColumns.filter(col => 
                            dataStats.columnStats[col].type === 'number'
                        );
                    }
                    
                    // If score-related columns are detected and relevant, use those
                    if (targetColumns.length === 0 && scoreRelatedColumns.length > 0) {
                        targetColumns = scoreRelatedColumns;
                    }
                    
                    // If still no target columns, use all numeric columns
                    if (targetColumns.length === 0) {
                        targetColumns = dataStats.columnNames.filter(col => 
                            dataStats.columnStats[col].type === 'number'
                        );
                    }
                    
                    // Calculate aggregations for each target column
                    const columnResults = {};
                    
                    for (const targetCol of targetColumns) {
                        const numericValues = jsonData
                            .map(row => row[targetCol])
                            .filter(val => typeof val === 'number' && !isNaN(val));
                        
                        if (numericValues.length > 0) {
                            columnResults[targetCol] = {};
                            
                            if (needsAverage) {
                                columnResults[targetCol].average = numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length;
                            }
                            
                            if (needsSum) {
                                columnResults[targetCol].sum = numericValues.reduce((sum, val) => sum + val, 0);
                            }
                            
                            if (needsCount) {
                                columnResults[targetCol].count = numericValues.length;
                            }
                            
                            if (needsMin) {
                                columnResults[targetCol].min = Math.min(...numericValues);
                            }
                            
                            if (needsMax) {
                                columnResults[targetCol].max = Math.max(...numericValues);
                            }
                        }
                    }
                    
                    results = {
                        type: "directAggregation",
                        targetColumns,
                        results: columnResults,
                        rowsAnalyzed: jsonData.length
                    };
                }
                
                console.log("Analysis results:", results);
            }
            
            // Prepare sample data for context (always useful, even with full analysis)
            const sampleData = jsonData.slice(0, Math.min(10, jsonData.length));
            
            // Format the prompt for Gemini
            const prompt = `
            You are a data analysis assistant. Answer the following question about this dataset:
            
            Dataset Information:
            - Total rows: ${dataStats.rowCount}
            - Total columns: ${dataStats.colCount}
            - Column names: ${dataStats.columnNames.join(', ')}
            
            ${needsFullAnalysis ? `
            I've performed a complete analysis on all ${jsonData.length} rows of the dataset.
            Analysis results:
            ${JSON.stringify(results, null, 2)}
            ` : ''}
            
            Sample data format (first few rows for reference):
            \`\`\`json
            ${JSON.stringify(sampleData, null, 2)}
            \`\`\`
            
            Previous conversation:
            ${conversationHistory}
            
            User's question: "${userQuestion}"
            
            Important instructions:
            1. Your answer must be based on the provided dataset analysis
            2. Use the full analysis results to answer the question accurately
            3. Format your response using markdown, especially for tables
            4. Clearly state that the analysis was performed on all ${jsonData.length} rows
            5. Be precise and direct in your answer
            `;
            
            // Send the prompt to Gemini
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-pro-exp-02-05:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.4,
                        maxOutputTokens: 1000,
                    },
                    safetySettings: [
                        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
                    ],
                }),
            });
            
            const data = await response.json();
            if (data && data.candidates?.[0]?.content?.parts?.[0]) {
                const answer = data.candidates[0].content.parts[0].text;
                setChatHistory(prev => [...prev, { role: 'gemini', message: answer }]);
            } else {
                throw new Error('Unexpected API response structure');
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
                    
                    <Paper elevation={3} sx={{ p: 2, mb: 3, backgroundColor: '#E3F2FD' }}>
                        <Typography variant="subtitle1" sx={{ mb: 1 }}>Upload Dataset (CSV)</Typography>
                        <input
                            type="file"
                            accept=".csv"
                            onChange={handleFileUpload}
                            style={{ display: 'none' }}
                            id="file-upload"
                            disabled={isProcessing}
                        />
                        <label htmlFor="file-upload">
                            <Button 
                                component="span" 
                                variant="contained" 
                                startIcon={<UploadFile />}
                                fullWidth
                                disabled={isProcessing}
                            >
                                Choose File
                            </Button>
                        </label>
                        {csvFile && (
                            <Typography variant="body2" sx={{ mt: 1 }}>
                                Selected: {csvFile.name}
                            </Typography>
                        )}
                    </Paper>
                    
                    {dataStats && (
                        <Paper elevation={3} sx={{ p: 2, mb: 3, backgroundColor: '#CFD8DC' }}>
                            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>Dataset Info</Typography>
                            <Typography>File: {csvFile?.name}</Typography>
                            <Typography>Size: {csvFile ? (csvFile.size / 1024).toFixed(2) + ' KB' : 'N/A'}</Typography>
                            <Typography>Rows: {dataStats.rowCount}</Typography>
                            <Typography>Columns: {dataStats.colCount}</Typography>
                            <Button
                                onClick={summarizeData}
                                disabled={isProcessing || !jsonData}
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
                                        Upload a CSV file and ask questions about your data!
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
                            disabled={isProcessing || !jsonData}
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
                            disabled={isProcessing || !currentQuestion.trim() || !jsonData}
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