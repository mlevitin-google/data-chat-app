// server.js (Node.js with Express)
const express = require('express');
const cors = require('cors');
const {
    GoogleGenerativeAI
} = require("@google/generative-ai");
//const { GoogleAIFileManager } = require("@google/generative-ai/server"); //Not being used

const dotenv = require('dotenv');
dotenv.config(); // Load environment variables from .env

const apiKey = process.env.GEMINI_API_KEY;

const app = express();
const port = 3001; // Or any other port you prefer

app.use(cors()); // Enable CORS for all routes (for development)
app.use(express.json({limit: '200mb'})); // to support JSON-encoded bodies
app.use(express.urlencoded({ extended: true, limit: '200mb' })); // to support URL-encoded bodies


app.post('/ask-question', async (req, res) => {
    const userQuestion = req.body.question; // Get the question from the request

     console.log(userQuestion); //print user question to the server console
     console.log(req.body); //prints the entire request

     const genAI = new GoogleGenerativeAI(apiKey);
     const model = genAI.getGenerativeModel({
         model: "gemini-2.0-flash",
         systemInstruction: "You are a helpful data analysis assistant. You have access to two data datasets. Focus on answering the question using the data available to you. Present it to the user in a clear, organized, and non-code-formatted way",
     });

     const generationConfig = {
         temperature: .5,
         topP: 0.95,
         topK: 40,
         maxOutputTokens: 8192,
         responseMimeType: "text/plain",
     };

     try {
            const chatSession = model.startChat({
                generationConfig,
                history: [
                    {
                        role: "user",
                        parts: [
                            {text: "summarize the data"}
                        ],
                    },
                    {
                        role: "model",
                        parts: [
                            {text: "Okay, here's a summary of the data you provided, focusing on key aspects relevant to the CG&E DM&A Ops Pillar and the VMAXX strategy:\n\n**Overall Context:**\n\n*   **Data Source:** You've provided two CSV files:\n\n    *   `[CG&E DM&A Ops Pillar] 2025.H1 VMAXX Responses + Backend Data - H1 2025 Raw Data.csv` : Data for the first half of 2025 (H1 2025).\n    *   `[CG&E DM&A Ops Pillar] 2025.H1 VMAXX Responses + Backend Data - H2 2024 Raw Data.csv` : Data for the second half of 2024 (H2 2024).\n\n*   **Data Focus:** The data is centered around understanding client maturity in data, tech, and measurement within the CG&E (likely Consumer Goods & Entertainment) sector. It uses the VMAXX strategy as a framework.\n*   **Key Metrics:** The datasets include a wide range of metrics, encompassing:\n\n    *   **Business Objectives & KPIs:** Primary business objectives, related marketing KPIs (including specifics like ROI/ROAS, brand equity, lead generation).\n    *   **VMAXX Pillars:**  Metrics related to Value (Brand Building, Consideration, Action), Max ROI (Learning Agenda, Experimentation, Incrementality), and X-Media (MMM, MTA, Reach).\n    *   **Data Maturity:**  Details on source of truth (SOT) for measurement (1P, 3P, in-house attribution, MMM, etc.).\n    *   **Experimentation & Incrementality:** Use of incrementality partners (Google, Dynata, Kantar, etc.) and experimentation methodologies (A/B testing, GeoX, Causal Impact).\n    *   **X-Media Modeling:**  Information on MMM (Marketing Mix Modeling) breakouts (Google, Programmatic, Format) and results, MTA (Multi-Touch Attribution), and reach measurement.\n    *   **Financial Performance:** Rolling revenue (12-month, 3-month, 1-month), impressions, clicks, conversions, and conversion value.\n\n**Key Themes and Potential Insights (based on column headings):**\n\n1.  **Client Segmentation:**\n\n    *   `vertical`, `parent`, `division`, `priority_account`, `subvertical`:  These columns allow you to segment clients based on industry, company structure, and account priority.  This is fundamental for understanding if maturity levels vary across different client types.\n\n2.  **Value Delivery and Stakeholder Alignment:**\n\n    *   `value_brand_building`, `value_consideration`, `value_action`:  These metrics are likely tied to the \"Value\" pillar of VMAXX.  Analyzing these, you can assess how well clients are progressing through the marketing funnel.\n    *   `value_delivered_stakeholder`:  Indicates the stakeholder level to whom value is being delivered (Day-to-Day, Mid-Level, C-Level).\n    *   `value_delivered_linked`, `value_delivered_group`: Provides info on value delivery and validation.\n\n3.  **Data and Measurement Maturity:**\n\n    *   `customer_sot_*`:  A significant portion of the data focuses on the \"Source of Truth\" (SOT) for measurement.  This helps gauge the sophistication of a client's data infrastructure and measurement approach.  For example, are they relying on basic Google Analytics, or do they have advanced 3P attribution models?\n    *   `maxroi_learning_agenda_score`: A score of the client's learning agenda can help gauge the progress of the clients measurement maturity\n    *   `xmedia_*`:  These columns capture how clients are approaching cross-channel measurement, using MMM, MTA, and reach metrics.\n\n4.  **Experimentation and Optimization:**\n\n    *   `maxroi_experiments_*`:  These columns provide insights into whether clients are actively using experimentation to validate and optimize their marketing efforts.\n\n5.  **X-Media Strategy**\n    *   `xmedia_triad_group`, `xmedia_trifecta_group`:  These could indicate adoption of a \"Triad\" (likely MMM, MTA, and Experimentation) or \"Trifecta\" approach to marketing measurement and optimization. This is a key indicator of maturity.\n\n**Potential Analysis and Next Steps:**\n\n1.  **Data Cleaning and Preparation:**  The raw data will likely need cleaning (handling missing values, inconsistencies, etc.) before analysis.\n\n2.  **Descriptive Statistics:** Calculate basic statistics (averages, medians, distributions) for key metrics across different client segments.\n\n3.  **Correlation Analysis:**  Explore correlations between different metrics.  For example:\n\n    *   Is there a correlation between SOT sophistication (e.g., using 3P attribution) and higher conversion values?\n    *   Does a higher \"Learning Agenda\" score correlate with better Max ROI metrics?\n    *   Is there a correlation between VMAXX scores and rolling revenue metrics?\n\n4.  **Trend Analysis:** Compare H2 2024 and H1 2025 data to identify trends in client maturity over time. Are clients generally improving in their data and measurement capabilities?\n\n5.  **Benchmarking:**  Establish benchmarks for different maturity levels. This will allow you to quickly assess a client's current state and identify areas for improvement.\n\n6.  **Actionable Insights and Recommendations:** Based on the analysis, develop data-driven recommendations for CG&E teams to help their clients improve their VMAXX scores and achieve better business outcomes.\n"},
                        ],
                    },
                ],
            });

          const result = await chatSession.sendMessage(userQuestion);
            console.log("Gemini response", result);
            res.json({ answer: result.response.text() });

        } catch (error) {
            console.error('Error processing question:', error);
            res.status(500).json({ error: 'Failed to process the question' });
        }

});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});