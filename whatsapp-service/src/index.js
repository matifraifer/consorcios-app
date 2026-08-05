import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import routes from './routes.js'

const app = express()
const allowedOrigins = (process.env.ALLOWED_ORIGIN ?? '').split(',').map((o) => o.trim()).filter(Boolean)

app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : '*' }))
app.use(express.json())

app.get('/health', (_req, res) => res.status(200).send('ok'))
app.use(routes)

const port = process.env.PORT || 3000
app.listen(port, () => console.log(`whatsapp-service escuchando en el puerto ${port}`))
