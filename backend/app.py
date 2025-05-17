from flask import Flask, request, jsonify, Response
from remi.model import PopMusicTransformer
from converter.converter import process_midi_file
import os
import tempfile
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes and all origins

def get_temp_dir():
    """Get the appropriate temp directory for the current OS"""
    return os.path.join(tempfile.gettempdir(), 'jamtemp')

# Create temp directory if it doesn't exist
os.makedirs(get_temp_dir(), exist_ok=True)

# Route 1: Simple GET
@app.route('/hello', methods=['GET'])
def hello():
    return jsonify({'message': 'Hello, world!'})

@app.route('/sanitize_audio', methods=["POST"])
def sanitize():
    data = request.get_json()

    inpath = data.get("inpath")
    outpath = data.get("outpath")
    
    # Use temp files if paths aren't provided
    if not inpath or not outpath:
        with tempfile.NamedTemporaryFile(dir=get_temp_dir(), suffix='.mid', delete=False) as infile, \
             tempfile.NamedTemporaryFile(dir=get_temp_dir(), suffix='.mid', delete=False) as outfile:
            process_midi_file(infile.name, outfile.name)
            return {'message': 'Audio processed with temp files'}, 200
    else:
        process_midi_file(inpath, outpath)
        return {'message': 'Audio processed with provided paths'}, 200

@app.route('/generate', methods=['POST'])
def generate():
    if request.method == 'POST':
        # Handle both JSON and file upload
        if request.files:
            file = request.files['file']
            if file.filename == '':
                return {'error': 'No selected file'}, 400
            
            # Save to temp file
            with tempfile.NamedTemporaryFile(dir=get_temp_dir(), suffix='.mid', delete=False) as temp_in:
                file.save(temp_in.name)
                inpath = temp_in.name
        else:
            data = request.get_json()
            inpath = data.get("inpath")
            if inpath:
                inpath = os.path.normpath(inpath)  # Normalize path separators

        # Create output temp file
        with tempfile.NamedTemporaryFile(dir=get_temp_dir(), suffix='.mid', delete=False) as temp_out:
            outpath = temp_out.name

        try:
            model = PopMusicTransformer(
                checkpoint='./remi/REMI-tempo-checkpoint',
                is_training=False)
            
            # generate continuation
            model.generate(
                n_target_bar=8,
                temperature=0.5,
                topk=10,
                output_path=outpath,
                prompt=inpath)
            
            # Read the generated file and return as response
            with open(outpath, 'rb') as f:
                midi_data = f.read()
            
            # Clean up temp files
            try:
                os.unlink(inpath)
                os.unlink(outpath)
            except:
                pass
            
            model.close()
            
            return Response(
                midi_data,
                mimetype="audio/midi",
                headers={"Content-Disposition": "attachment;filename=generated.mid"})
            
        except Exception as e:
            # Clean up temp files if they exist
            if 'inpath' in locals() and os.path.exists(inpath):
                try:
                    os.unlink(inpath)
                except:
                    pass
            if 'outpath' in locals() and os.path.exists(outpath):
                try:
                    os.unlink(outpath)
                except:
                    pass
                
            print("Exception occurred:", str(e))
            import traceback
            traceback.print_exc()
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

    # Save to temp directory
    with tempfile.NamedTemporaryFile(dir=get_temp_dir(), suffix='.mid', delete=False) as temp_file:
        file.save(temp_file.name)
        filepath = temp_file.name

    # Return the normalized path
    normalized_path = os.path.normpath(filepath)
    print(f"Saved MIDI to temporary location: {normalized_path}")
    
    return {
        'message': 'MIDI uploaded to temporary storage',
        'path': normalized_path,
        'warning': 'File is temporary and will be deleted when the container shuts down'
    }, 200

if __name__ == '__main__':
    app.run(debug=True)