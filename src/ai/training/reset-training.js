/**
 * Reset Training Script
 * 
 * Clears corrupted training data and model from IndexedDB and localStorage
 * to start fresh after fixing action encoding bugs.
 */

export async function resetTraining() {
  // Clear localStorage training data
  try {
    localStorage.removeItem('training_data.json');
  } catch (e) {
  }
  
  // Clear IndexedDB model
  try {
    const tf = await import('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.11.0/dist/tf.min.js');
    
    // Try to remove the model
    const modelPath = 'indexeddb://board-game-ai';
    try {
      await tf.io.removeModel(modelPath);
    } catch (e) {
    }
  } catch (e) {
    console.error('[Reset] Error during reset:', e);
  }
}

// Auto-run if loaded directly
if (typeof window !== 'undefined') {
}
