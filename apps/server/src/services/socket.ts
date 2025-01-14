import { Server } from 'socket.io'
import Redis from 'ioredis'
import prismaClient from './prisma'
import { produceMessage } from './kafka'

const pub = new Redis({
  host: process.env.REDIS_HOST!,
  port: parseInt(process.env.REDIS_PORT!, 10),
  username: process.env.REDIS_USERNAME!,
  password: process.env.REDIS_PASSWORD!,
})

const sub = new Redis({
  host: process.env.REDIS_HOST!,
  port: parseInt(process.env.REDIS_PORT!, 10),
  username: process.env.REDIS_USERNAME!,
  password: process.env.REDIS_PASSWORD!,
})

class SocketService {
  private _io: Server

  constructor() {
    console.log('Init Socket Service...')
    this._io = new Server({
      cors: {
        allowedHeaders: ['*'],
        origin: '*',
      },
    })

    sub.subscribe(process.env.KAFKA_TOPIC!)
  }

  public initListeners() {
    const io = this._io

    console.log('Init Socket Listeners...')

    io.on('connect', (socket) => {
      console.log(`New socket connected`, socket.id)

      socket.on('event:message', async ({ message }: { message: string }) => {
        console.log('New Message received', message)

        await pub.publish(process.env.KAFKA_TOPIC!, JSON.stringify({ message }))
      })
    })

    sub.on('message', async (channel, message) => {
      if (channel === process.env.KAFKA_TOPIC!) {
        console.log('new message from redis', message)
        io.emit('message', message)

        // await prismaClient.message.create({
        //   data: {
        //     text: message,
        //   },
        // })

        await produceMessage(message)
        console.log('Message Produced to Kafka Broker')
      }
    })
  }

  get io() {
    return this._io
  }
}

export default SocketService
