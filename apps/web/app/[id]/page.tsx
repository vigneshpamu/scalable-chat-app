'use client'
import { useState } from 'react'
import classes from '.././page.module.css'
import { useSocket } from '../../context/SocketProvider'

export default function Page() {
  const { sendMessage, messages } = useSocket()
  const [message, setMessage] = useState('')

  return (
    <div>
      <div>
        <input
          onChange={(e) => setMessage(e.target.value)}
          value={message}
          className={classes['chat-input']}
          placeholder="Message..."
        />
        <button
          onClick={(e) => {
            sendMessage(message)
            setMessage('')
          }}
          className={classes['button']}
        >
          Send
        </button>
      </div>
      <div>
        {messages.map((e, i) => (
          <li key={i}>{e}</li>
        ))}
      </div>
    </div>
  )
}
