const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('public'));


let tickets = [];

function generateTicket(number) {
    const ticket = Array.from({ length: 3 }, () => Array(9).fill(null));
    const numbers = Array.from({ length: 90 }, (_, i) => i + 1);

    // Each column has a specific range
    const columnRanges = [
        [1, 9], [10, 19], [20, 29], [30, 39], [40, 49],
        [50, 59], [60, 69], [70, 79], [80, 90]
    ];

    // Fill each column according to the range
    for (let col = 0; col < 9; col++) {
        // Select 3 random numbers within the column's range
        const colNumbers = numbers
            .filter(n => n >= columnRanges[col][0] && n <= columnRanges[col][1])
            .sort(() => Math.random() - 0.5)
            .slice(0, 3)
            .sort((a, b) => a - b);

        // Place the numbers into the column, ensuring one number per row
        colNumbers.forEach((num, row) => {
            ticket[row][col] = num;
            // Remove the number from the pool
            numbers.splice(numbers.indexOf(num), 1);
        });
    }

    // Ensure each row has exactly 5 numbers by removing 4 random cells per row
    ticket.forEach(row => {
        const filledIndices = row.map((num, idx) => num !== null ? idx : null).filter(idx => idx !== null);
        const indicesToRemove = filledIndices.sort(() => Math.random() - 0.5).slice(0, 4);
        indicesToRemove.forEach(idx => row[idx] = null);
    });

    return { number, grid: ticket, bookedBy: null };
}

wss.on('connection', ws => {
    ws.on('message', message => {
        const data = JSON.parse(message);
        if (data.type === 'set') {
            const newTickets = [];
            for (let i = 0; i < data.count; i++) {
                newTickets.push(generateTicket(tickets.length + 1));
            }
            tickets = [...tickets, ...newTickets];
            wss.clients.forEach(client => client.send(JSON.stringify({ tickets })));
        } else if (data.type === 'book') {
            for (let i = 0; i < data.count; i++) {
                const ticket = tickets.find(ticket => !ticket.bookedBy);
                if (ticket) {
                    ticket.bookedBy = data.name;
                }
            }
            wss.clients.forEach(client => client.send(JSON.stringify({ tickets })));
        } else if (data.type === 'search') {
            const filteredTickets = tickets.filter(ticket => ticket.number.toString().includes(data.query));
            ws.send(JSON.stringify({ tickets: filteredTickets }));
        }
    });

    ws.send(JSON.stringify({ tickets }));
});

app.use(express.static(path.join(__dirname, 'public')));

server.listen(3000, () => {
    console.log('Server is listening on port 3000');
});
