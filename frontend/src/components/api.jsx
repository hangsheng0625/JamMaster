// 1. GET /hello
export const fetchHello = async () => {
  try {
    const res = await fetch('http://localhost:5000/hello');
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('Hello error:', err);
  }
};

// 2. POST /sanitize_audio
export const fetchSanitizeAudio = async (inpath) => {
  try {
    const res = await fetch('http://localhost:5000/sanitize_audio', {
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

// 3. POST /generate
export const fetchGenerate = async (inpath) => {
  try {
    const res = await fetch('http://localhost:5000/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inpath })
    });

    if (!res.ok) {
      throw new Error('Generate request failed');
    }

    // Return the blob directly
    return await res.blob();
  } catch (err) {
    console.error('Generate error:', err);
    throw err;
  }
};

// 4. GET /test
export const fetchTest = async () => {
  try {
    const res = await fetch('http://localhost:5000/test');
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('Test error:', err);
  }
};
