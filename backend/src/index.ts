import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import proposalRoutes from './routes/proposals';

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Naraworks Backend is API Ready');
});

app.use('/api/proposals', proposalRoutes);

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
