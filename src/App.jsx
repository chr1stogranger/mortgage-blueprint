import MortgageBlueprint from './MortgageBlueprint'
import BlueprintAuth from './BlueprintAuth'

function App() {
  return (
    <BlueprintAuth>
      <MortgageBlueprint />
    </BlueprintAuth>
  )
}

export default App