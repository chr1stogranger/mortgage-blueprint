import { useState, useEffect } from 'react'
import MortgageBlueprint from './MortgageBlueprint'
import BlueprintAuth from './BlueprintAuth'
import SharePortal from './SharePortal'

function App() {
  const [shareToken, setShareToken] = useState(null);
  const [fullCalcState, setFullCalcState] = useState(null);

  // Detect ?share=TOKEN in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('share');
    if (token && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
      setShareToken(token);
    }
  }, []);

  // If share token present, show the borrower portal
  if (shareToken && !fullCalcState) {
    return (
      <SharePortal
        shareToken={shareToken}
        onEnterFullCalculator={(stateData) => {
          // Switch from portal to full calculator with pre-loaded state
          setFullCalcState(stateData);
          setShareToken(null);
          // Clean URL
          window.history.replaceState({}, '', window.location.pathname);
        }}
      />
    );
  }

  // Normal Blueprint (with optional pre-loaded state from share portal)
  return (
    <BlueprintAuth>
      <MortgageBlueprint initialState={fullCalcState} />
    </BlueprintAuth>
  )
}

export default App
