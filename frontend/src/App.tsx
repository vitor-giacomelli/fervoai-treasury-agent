import { TacticalHUD } from './components/hud/TacticalHUD'
import { useTreasuryStream } from './hooks/useTreasuryStream'

function App() {
  const stream = useTreasuryStream()
  return <TacticalHUD stream={stream} />
}

export default App
