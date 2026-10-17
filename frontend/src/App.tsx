import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <main>
      <h1>Banana frontend</h1>
      <p>The local React + TypeScript starter is ready.</p>
      <button type="button" onClick={() => setCount((value) => value + 1)}>
        Count is {count}
      </button>
      <p className="hint">
        Edit <code>src/App.tsx</code> to start building.
      </p>
    </main>
  )
}

export default App
