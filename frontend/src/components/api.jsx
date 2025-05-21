const apiUrl = process.env.REACT_APP_API_URL;

// 1. GET /hello
export const fetchHello = async () => {
  try {
    const res = await fetch(`${apiUrl}/hello`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('Hello error:', err);
  }
};

// 2. POST /sanitize_audio
export const fetchSanitizeAudio = async (inpath) => {
  try {
    const res = await fetch(`${apiUrl}/sanitize_audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inpath })
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('Sanitize error:', err);
  }
};

// 3. POST /generate (with all parameters)
export const fetchGenerate = async (
  inpath, 
  temperature = 0.5, 
  nTargetBar = 8, // Changed from n_target_bar to match the parameter name in your component
  topk = 10
) => {
  try {
    const res = await fetch(`${apiUrl}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inpath,
        temperature: Number(temperature),
        n_target_bar: Number(nTargetBar), // Convert to n_target_bar for backend compatibility
        topk: Number(topk)
      })
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Generation failed');
    }

    return await res.blob();
  } catch (err) {
    console.error('Generate error:', err);
    throw err;
  }
};
// 4. GET /test
export const fetchTest = async () => {
  try {
    const res = await fetch(`${apiUrl}/test`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('Test error:', err);
  }
};
