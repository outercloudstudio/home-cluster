import * as path from '@std/path'
import { decodeBase64, encodeBase64 } from 'jsr:@std/encoding/base64'

export function proxy(address: string, localPort: number, remotePort: number) {
	const url = URL.parse(address)
	const host = url?.host
	const pathname = url?.pathname

	if(!host) throw new Error('Address must have a host!')
	if(!pathname) throw new Error('Address must have a pathname!')

	const websocketUrl = 'ws://' + path.join(host, pathname, 'proxy')

	const socket = new WebSocket(websocketUrl)

    const connections: Record<string, Deno.TcpConn | null> = {}
    const messageQueue: Record<string, Uint8Array[]> = {}

    async function sendMessages() {
        for(const id of Object.keys(messageQueue)) {
            if(messageQueue[id].length === 0) continue
            if(!connections[id]) continue

            const buffer = messageQueue[id].shift()!

            let pointer = 0
            
            while(pointer < buffer.length) {
                const bytesWritten = await connections[id].write(buffer.slice(pointer, buffer.length))
                
                pointer += bytesWritten

                console.log(`Wrote ${bytesWritten} bytes to ${id}!`)
            }
        }
        
        setTimeout(() => {
            sendMessages()
        }, 10);
    }

    async function handleConnection(id: string) {
        try {
            while(connections[id]) {
                const connection = connections[id]

                const buffer = new Uint8Array(4096)
                const bytesRead = await connection.read(buffer)

                console.log(`Read ${bytesRead} bytes from tcp connection ${id}`)

                if(bytesRead === null) {
                    connection.close()

                    socket.send(JSON.stringify({ type: 'close-client', id }))

                    connections[id]?.close()
                    delete connections[id]
                    delete messageQueue[id]
                    
                    break
                } else {
                    socket.send(JSON.stringify({ type: 'bytes', id, bytes: encodeBase64(buffer.slice(0, bytesRead)) }))
                }
            }
        } catch {
            socket.send(JSON.stringify({ type: 'close-client', id }))

            connections[id]?.close()
            delete connections[id]
            delete messageQueue[id]
        }
    }

	socket.addEventListener('open', async () => {
		console.log('Successfully connected to the server!')

        socket.send(JSON.stringify({ type: 'setup', port: remotePort }))
	})

	socket.addEventListener('message', async (event) => {
		console.log('Message received from server:', event.data)

		let message: any = null

		try {
			message = JSON.parse(event.data)
		}catch {}

		if(!message) return

        if(message.type === 'new-client') {
            connections[message.id] = null
            messageQueue[message.id] = []

            const connection = await Deno.connect({
                hostname: 'localhost',
                port: localPort,
                transport: 'tcp',
            })

            connections[message.id] = connection

            console.log(`Client connected ${message.id}!`)

            handleConnection(message.id)
        }

        if(message.type === 'bytes') {
            messageQueue[message.id].push(decodeBase64(message.bytes))

            console.log(`Recieved bytes for ${message.id}`)
        }

        if(message.type === 'close-client') {
            connections[message.id]?.close()
            delete connections[message.id]
            delete messageQueue[message.id]
        }
	})

	socket.addEventListener('error', (error) => {
		console.error('WebSocket error:', (error as ErrorEvent).message)
	})

	socket.addEventListener('close', async (event) => {
		console.log(`Connection closed. Code: ${event.code}, Reason: ${event.reason}`)
	})

    sendMessages()
}