from flask import Flask, request, jsonify
from remi.model import PopMusicTransformer
from converter.converter import process_midi_file
import os
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes and all origins

UPLOAD_FOLDER = './recordings'  # Relative to where Flask runs
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Route 1: Simple GET
@app.route('/hello', methods=['GET'])
def hello():
    return jsonify({'message': 'Hello, world!'})

@app.route('/sanitize_audio', methods=["POST"])
def sanitize():
    data = request.get_json()

    inpath = data.get("inpath")
    outpath = data.get("inpath")
    process_midi_file(inpath, outpath)

# Route 2: Generate 
@app.route('/generate', methods=['POST'])
def generate():
    data = request.get_json()

    inpath = data.get("inpath")
    if inpath:
        inpath = inpath.replace('\\', '/')
    outpath = os.path.join(UPLOAD_FOLDER, "generated.mid")
    try:
        print("inpath", inpath)
        print("we are in try")
        model = PopMusicTransformer(
            checkpoint='./remi/REMI-tempo-checkpoint',
            is_training=False)
        
        # generate continuation
        model.generate(
            n_target_bar=16,
            temperature=1.2,
            topk=5,
            output_path=outpath,
            prompt=inpath)
            
        # close model
        model.close()
        return {'message': '', 'path': outpath}, 200
    except Exception as e:
        print("Exception occurred:", str(e))
        import traceback
        traceback.print_exc()  # This prints the full stack trace
        return {'error': str(e)}, 500
    
    
@app.route('/test', methods=['GET'])
def test():
    return jsonify({'message': "".join(["hello " for i in range(20)])})

@app.route('/upload_midi', methods=['POST'])
def upload_midi():
    if 'file' not in request.files:
        return {'error': 'No file part in request'}, 400

    file = request.files['file']
    if file.filename == '':
        return {'error': 'No selected file'}, 400

    filepath = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(filepath)

    # Convert to forward slashes for consistent cross-platform behavior
    normalized_path = filepath.replace('\\', '/')
    print(f"Saved MIDI to {filepath}, normalized as {normalized_path}")
    
    # Return the normalized path with forward slashes
    return {'message': 'MIDI uploaded and saved', 'path': normalized_path}, 200

if __name__ == '__main__':
    app.run(debug=True)

