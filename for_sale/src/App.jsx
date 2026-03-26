import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'
import RedSquare from './RedSquare'
import Card from './Card'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>      <RedSquare />
      <Card
        // image="https://via.placeholder.com/350x200"
        // title="iPhone 13 Pro"
        // description="Excellent condition iPhone 13 Pro with all original accessories. Battery health at 95%."
        // price="599"
        // category="Electronics"
        // condition="Like New"
        // location="San Francisco, CA"
        // datePosted="2 hours ago"
        // seller="John Doe"
        // tags={["Phone", "Apple", "Unlocked"]}
      />


  
      <section id="spacer"></section>
    </>
  )
}

export default App
