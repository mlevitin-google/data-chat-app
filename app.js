const {
  GoogleGenerativeAI,
} = require("@google/generative-ai");
const { GoogleAIFileManager } = require("@google/generative-ai/server");
const dotenv = require('dotenv')
const fs = require('fs');
const Papa = require('papaparse');
const React = require('react')

const { useState, useRef, useEffect } = React;
const { Button, Grid, Paper, Typography, Box, CircularProgress, TextField, createTheme, ThemeProvider } = require('@mui/material');
const { Send } = require('@mui/icons-material');
const ReactMarkdown = require('react-markdown');
const remarkGfm = require('remark-gfm');
const { createElement } = require('react');

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

dotenv.config({ path: '.env' });

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

/**
 * Uploads the given file to Gemini.
 *
 * See https://ai.google.dev/gemini-api/docs/prompting_with_media
 */
async function uploadToGemini(path, mimeType) {
  const uploadResult = await fileManager.uploadFile(path, {
    mimeType,
    displayName: path,
  });
  const file = uploadResult.file;
  console.log(`Uploaded file ${file.displayName} as: ${file.name}`);
  return file;
}

/**
 * Waits for the given files to be active.
 *
 * Some files uploaded to the Gemini API need to be processed before they can
 * be used as prompt inputs. The status can be seen by querying the file's
 * "state" field.
 *
 * This implementation uses a simple blocking polling loop. Production code
 * should probably employ a more sophisticated approach.
 */
async function waitForFilesActive(files) {
  console.log("Waiting for file processing...");
  for (const name of files.map((file) => file.name)) {
    let file = await fileManager.getFile(name);
    while (file.state === "PROCESSING") {
      process.stdout.write(".")
      await new Promise((resolve) => setTimeout(resolve, 10_000));
      file = await fileManager.getFile(name)
    }
    if (file.state !== "ACTIVE") {
      throw Error(`File ${file.name} failed to process`);
    }
  }
  console.log("...all files ready\n");
}

const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash-exp",
  systemInstruction: "Welcome to the Hoppers Hub AI companion! You can ask me any question about the Hoppers Hub datasets and I'll do my best to answer:\n\nRole and Purpose:\n\n\n\n* You are an analyst on the CG&E sector team tasked with understanding insights from large datasets.\n\n* You will use the Hopper's Hub data, which provides the DM&A (likely Data, Measurement, and Analytics) team with metrics based on the VMAXX strategy.\n\n* Your goal is to help CG&E teams understand their clients' data, tech, and measurement maturity.\n\n* This tool facilitates effective business planning, promotes knowledge sharing, and ensures a unified perspective.\n\n\n\nBehaviors and Rules:\n\n1) Data Interpretation:\n\na) Analyze the Hopper's Hub data to identify key insights and trends related to client maturity.\n\nb) Clearly explain the meaning and implications of various metrics and data points.\n\nc) Connect data insights to the VMAXX strategy and its goals.\n\n2) Client Understanding:\n\na) Help CG&E teams understand their clients' current state in terms of data, technology, and measurement.\n\nb) Identify areas where clients can improve their maturity and achieve better results.\n\nc) Translate complex data concepts into clear and actionable recommendations for clients.\n\n3) Business Planning:\n\na) Use data insights to inform business planning and decision-making for CG&E teams.\n\nb) Provide data-driven recommendations for resource allocation, strategy development, and project prioritization.\n\nc) Help teams align their activities with the overall VMAXX strategy and business goals.\n\n4) Knowledge Sharing:\n\na) Share insights and best practices with CG&E teams to promote knowledge sharing and collaboration.\n\nb) Facilitate discussions and workshops to help teams understand and utilize the Hopper's Hub data effectively.\n\nc) Create clear and concise reports and presentations to communicate key findings to stakeholders.\n\nTone and Style:\n\n* Maintain a professional and analytical tone.\n\n* Use clear and concise language, avoiding jargon or technical terms when possible.\n\n* Be objective and data-driven in your analysis and recommendations.\n\n* Focus on providing actionable insights that can help CG&E teams achieve their goals.",
});

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
  responseMimeType: "text/plain",
};
const chatSession = model.startChat({
    generationConfig,
    history: [],
  });
const files = [
    await uploadToGemini("[CG&E DM&A Ops Pillar] 2025.H1 VMAXX Responses + Backend Data - H1 2025 Raw Data.csv", "text/csv"),
    await uploadToGemini("CG&E_DM&A___Hopper's_Hub_(go_hoppershub) (1).pdf", "application/pdf"),
    await uploadToGemini("[CG&E DM&A Ops Pillar] 2025.H1 VMAXX Responses + Backend Data - H2 2024 Raw Data.csv", "text/csv"),
  ];

  // Some files have a processing delay. Wait for them to be ready.
  await waitForFilesActive(files);

  const chatSession = model.startChat({
    generationConfig,
    history: [],
  });

/**
 * Uploads the given file to Gemini.
 *
 * See https://ai.google.dev/gemini-api/docs/prompting_with_media
 */
async function uploadToGemini(path, mimeType) {
  const uploadResult = await fileManager.uploadFile(path, {
    mimeType,
    displayName: path,
  });
  const file = uploadResult.file;
  console.log(`Uploaded file ${file.displayName} as: ${file.name}`);
  return file;
}

/**
 * Waits for the given files to be active.
 *
 * Some files uploaded to the Gemini API need to be processed before they can
 * be used as prompt inputs. The status can be seen by querying the file's
 * "state" field.
 *
 * This implementation uses a simple blocking polling loop. Production code
 * should probably employ a more sophisticated approach.
 */
async function waitForFilesActive(files) {
  console.log("Waiting for file processing...");
  for (const name of files.map((file) => file.name)) {
    let file = await fileManager.getFile(name);
    while (file.state === "PROCESSING") {
      process.stdout.write(".")
      await new Promise((resolve) => setTimeout(resolve, 10_000));
      file = await fileManager.getFile(name)
    }
    if (file.state !== "ACTIVE") {
      throw Error(`File ${file.name} failed to process`);
    }
  }
  console.log("...all files ready\n");
}
  
const files = [
    await uploadToGemini("[CG&E DM&A Ops Pillar] 2025.H1 VMAXX Responses + Backend Data - H1 2025 Raw Data.csv", "text/csv"),
    await uploadToGemini("CG&E_DM&A___Hopper's_Hub_(go_hoppershub) (1).pdf", "application/pdf"),
    await uploadToGemini("[CG&E DM&A Ops Pillar] 2025.H1 VMAXX Responses + Backend Data - H2 2024 Raw Data.csv", "text/csv"),
  ];

  // Some files have a processing delay. Wait for them to be ready.
  await waitForFilesActive(files);


const { useState, useRef, useEffect } = React;
const { Button, Grid, Paper, Typography, Box, CircularProgress, TextField, createTheme, ThemeProvider } = require('@mui/material');
const { Send } = require('@mui/icons-material');
const ReactMarkdown = require('react-markdown');
const remarkGfm = require('remark-gfm');
const { createElement } = require('react');
const ReactDOM = require('react-dom/client');
const root = ReactDOM.createRoot(document.getElementById('root'));

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
                    const csvText1Path = 'public/data/h12025.csv'
                    const csvText2Path = 'public/data/h22024.csv'
                    loadedCsvText1 = fs.readFileSync(csvText1Path, 'utf8');
                    loadedCsvText2 = fs.readFileSync(csvText2Path, 'utf8')
                setCsvText1(loadedCsvText1);
                setCsvText2(loadedCsvText2);
                }
                catch (error) {
                  console.error("Error loading files:", error);
                }

                //parse for the stats
                const parsedData1 = await Papa.parse(loadedCsvText1, {header: true, dynamicTyping: true}).data
                const parsedData2 = await Papa.parse(loadedCsvText2, {header: true, dynamicTyping: true}).data
                setDataStats1(computeDataStats(parsedData1));
                setDataStats2(computeDataStats(parsedData2));

            } catch (error) {
                console.error("Error loading or initializing:", error);
            }
        };

        loadData();

        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatHistory]);

    const handleSendQuestion = async () => {
      if (!currentQuestion.trim() || !chatHistory || !csvText1 || !csvText2) {
        console.error("Not ready to send:", { currentQuestion, chatHistory, csvText1, csvText2 });
        return;
      }
        
      setIsProcessing(true);
      setChatHistory(prev => [...prev, { role: 'user', message: currentQuestion.trim() }]);
      setCurrentQuestion('');

      try {
          const response = await chatSession.sendMessage({
              parts: [{ text: currentQuestion.trim() }],
            history: chatHistory.map(item => ({
                role: item.role === 'user' ? 'user' : 'model', // Correct roles for Gemini
                parts: [{ text: item.message }] // Correct structure
            })),
            generationConfig: {
                temperature: 0.4,
                topP: 0.95,
                topK: 40,
                maxOutputTokens: 8192,
            },
            dataContext: `
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
        ` }),
        const responseText = result.response.text();
        setChatHistory(prev => [...prev, { role: 'gemini', message: responseText }]);
      } catch (error) {
        console.error("Error sending message:", error);
        setChatHistory(prev => [...prev, { role: 'gemini', message: "Sorry, I encountered an error." }]);
      } finally {
        setIsProcessing(false);
      }
    };

    const handleClearChat = () => {
        setChatHistory([]);
    };

    return (
      React.createElement(ThemeProvider, { theme: theme },
            React.createElement(Grid, { container: true, spacing: 2, sx: {
                backgroundColor: 'background.default',
                color: 'text.primary',
                p: 4,
                justifyContent: 'center',
                maxWidth: '80vw',
                minHeight: '100vh'
            }},
               React.createElement(Grid, { item: true, xs: 12, md: 3, sx: { p: 2 }},
                    React.createElement(Typography, { variant: "h5", sx: { fontWeight: 'bold', mb: 2 }},"Data Chat"),
                    (dataStats1 || dataStats2) && (
                        React.createElement(Paper, { elevation: 3, sx: { p: 2, mb: 3, backgroundColor: '#CFD8DC' }},
                            React.createElement(Typography, {variant: "h6", sx: { fontWeight: 'bold', mb: 1 }},"Dataset Info"),
                            React.createElement(Typography, null, "Rows 1: ",dataStats1?.rowCount || 'N/A'),
                            React.createElement(Typography, null, "Columns 1: ",dataStats1?.colCount || 'N/A'),

                            React.createElement(Typography, null, "Rows 2: ",dataStats2?.rowCount || 'N/A'),
                            React.createElement(Typography, null, "Columns 2: ",dataStats2?.colCount || 'N/A'),
                           React.createElement(Button, {
                                variant: "outlined",
                                color: "primary",
                                onClick: handleClearChat,
                                disabled: isProcessing,
                                sx: { mt: 2, mb: 2 }
                            }, "Clear Chat")
                        )
                    )
                ),
                React.createElement(Grid, {item: true, xs: 12, md: 9, sx: { p: 2, display: 'flex', flexDirection: 'column', height: '90vh' }},
                    React.createElement(Paper, { elevation: 3, sx: {
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        p: 2,
                        backgroundColor: '#ECEFF1',
                        mb: 2,
                        overflow: 'hidden'
                    }},
                        React.createElement(Typography, { variant: "h6", sx: { mb: 2 }}, "Chat with Your Data"),

                        React.createElement(Box, {
                            sx: {
                                flex: 1,
                                overflowY: 'auto',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 2,
                                p: 1
                            }},
                            ref: chatContainerRef,
                            children: [
                            chatHistory.length === 0 && (
                                React.createElement(Paper, { elevation: 1, sx: { p: 2, bgcolor: '#E8EAF6', alignSelf: 'center', maxWidth: '80%' }},
                                    React.createElement(Typography, {variant: "body1"},
                                        "Welcome to Hoppers Hub AI! Feel free to ask me questions about the data from the H2 2024 and H1 2025 Hopper's Hub reports"
                                    )
                                )
                            ),

                            chatHistory.map((message, index) => (
                                React.createElement(Paper, {
                                    key: index,
                                    elevation: 1,
                                    sx: {
                                        p: 2,
                                        borderRadius: 2,
                                        maxWidth: '75%',
                                        alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                                        backgroundColor: message.role === 'user' ? '#BBDEFB' : '#E8F5E9',
                                    }},
                                    React.createElement(ReactMarkdown, {remarkPlugins: [remarkGfm]}>{message.message}</ReactMarkdown>
                                )
                            )),

                            isProcessing && (
                                React.createElement(Paper, { elevation: 1, sx: {
                                    p: 2,
                                    borderRadius: 2,
                                    alignSelf: 'flex-start',
                                    backgroundColor: '#E0E0E0',
                                    display: 'flex',
                                    alignItems: 'center'
                                }},
                                    React.createElement(CircularProgress, { size: 20, sx: { mr: 1 }}, null),
                                    React.createElement(Typography, null, "Processing...")
                                )
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
    )
}

  
    const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    React.createElement(DataChatApp)
);

module.exports = DataChatApp
