const axios = require('axios');

const URL = "http://152.67.33.214:8080";
const INSTANCE = "admin_profamilia";
const API_KEY = "casauniao_secret_key";

async function testSend() {
    const endpoint = `${URL}/message/sendText/${INSTANCE}`;
    const payload = {
        number: "5511999999999",
        text: "Teste de integração da plataforma Profamília"
    };

    console.log(`Sending to ${endpoint}...`);
    try {
        const res = await axios.post(endpoint, payload, {
            headers: {
                apikey: API_KEY,
                'Content-Type': 'application/json'
            }
        });
        console.log("Status:", res.status);
        console.log("Response:", res.data);
    } catch (e) {
        console.error("Error Status:", e.response?.status);
        console.error("Error Data:", JSON.stringify(e.response?.data, null, 2) || e.message);
    }
}

testSend();
