from flask import Flask, request, jsonify, Response
from remi.model import PopMusicTransformer
from converter.converter import process_midi_file
import os
import tempfile
import subprocess
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes and all origins

def get_temp_dir():
    """Get the appropriate temp directory for the current OS"""
    return os.path.join(tempfile.gettempdir(), 'jamtemp')

# Create temp directory if it doesn't exist
os.makedirs(get_temp_dir(), exist_ok=True)

def download_model_if_needed():
    """Download model from Google Cloud Storage if it doesn't exist locally"""
    model_path = './remi/REMI-tempo-chord-checkpoint'
    
    if not os.path.exists(model_path):
        print("Model checkpoint not found locally. Downloading from Google Cloud Storage...")
        try:
            # Create the directory structure
            os.makedirs('./remi', exist_ok=True)
            
            # Download from Cloud Storage
            bucket_name = os.environ.get('MODEL_BUCKET_NAME', 'jammaster-models-160279')
            cmd = f'gsutil -m cp -r gs://{bucket_name}/REMI-tempo-chord-checkpoint ./remi/'
            
            print(f"Running command: {cmd}")
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
            
            if result.returncode == 0:
                print("Model downloaded successfully!")
                print(f"Download output: {result.stdout}")
            else:
                print(f"Error downloading model: {result.stderr}")
                return False
                
        except Exception as e:
            print(f"Exception during model download: {e}")
            return False
    else:
        print("Model checkpoint found locally.")
    
    return os.path.exists(model_path)

# Global variable to track if model is available
print("Checking model availability...")
MODEL_AVAILABLE = download_model_if_needed()
print(f"Model available: {MODEL_AVAILABLE}")

# Route 1: Simple GET
@app.route('/hello', methods=['GET'])
def hello():
    return jsonify({'message': 'Hello, world!'})

@app.route('/model_status', methods=['GET'])
def model_status():
    """Check model availability"""
    return jsonify({
        'model_available': MODEL_AVAILABLE,
        'checkpoint_path_exists': os.path.exists('./remi/REMI-tempo-chord-checkpoint'),
        'remi_dir_exists': os.path.exists('./remi'),
        'remi_dir_contents': os.listdir('./remi') if os.path.exists('./remi') else None,
        'checkpoint_contents': os.listdir('./remi/REMI-tempo-chord-checkpoint') if os.path.exists('./remi/REMI-tempo-chord-checkpoint') else None,
        'working_directory': os.getcwd()
    })

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
    global MODEL_AVAILABLE
    
    if not MODEL_AVAILABLE:
        return {'error': 'Model checkpoint not available. Please check model_status endpoint.'}, 503
    
    if request.method == 'POST':
        print("=== GENERATE ENDPOINT CALLED ===")
        
        # Default parameters
        default_params = {
            'n_target_bar': 8,
            'temperature': 0.5,
            'topk': 10
        }

        # Handle both JSON and file upload
        if request.files:
            file = request.files['file']
            if file.filename == '':
                return {'error': 'No selected file'}, 400
            
            # Save to temp file
            with tempfile.NamedTemporaryFile(dir=get_temp_dir(), suffix='.mid', delete=False) as temp_in:
                file.save(temp_in.name)
                inpath = temp_in.name
            
            # Extract parameters from form data
            params = {
                'n_target_bar': request.form.get('n_target_bar', default_params['n_target_bar']),
                'temperature': request.form.get('temperature', default_params['temperature']),
                'topk': request.form.get('topk', default_params['topk'])
            }
        else:
            data = request.get_json()
            inpath = data.get("inpath")
            if inpath:
                inpath = os.path.normpath(inpath)
            
            # Extract parameters from JSON
            params = {
                'n_target_bar': data.get('n_target_bar', default_params['n_target_bar']),
                'temperature': data.get('temperature', default_params['temperature']),
                'topk': data.get('topk', default_params['topk'])
            }

        print(f"Input path: {inpath}")
        print(f"Parameters: {params}")

        # Validate and convert parameters
        try:
            generation_params = {
                'n_target_bar': int(params['n_target_bar']),
                'temperature': float(params['temperature']),
                'topk': int(params['topk'])
            }
            print(f"Converted parameters: {generation_params}")
        except ValueError as e:
            print(f"Parameter conversion error: {e}")
            return {'error': f'Invalid parameter value: {str(e)}'}, 400

        # Create output temp file
        with tempfile.NamedTemporaryFile(dir=get_temp_dir(), suffix='.mid', delete=False) as temp_out:
            outpath = temp_out.name

        print(f"Output path: {outpath}")

        # Check if input file exists
        if not os.path.exists(inpath):
            print(f"ERROR: Input file does not exist: {inpath}")
            return {'error': 'Input file not found'}, 400
        
        input_size = os.path.getsize(inpath)
        print(f"Input file size: {input_size} bytes")

        try:
            print("Loading PopMusicTransformer model...")
            model = PopMusicTransformer(
                checkpoint='./remi/REMI-tempo-chord-checkpoint',
                is_training=False)
            print("Model loaded successfully")
            
            print("Starting generation...")
            model.generate(
                **generation_params,
                output_path=outpath,
                prompt=inpath)
            print("Generation completed")
            
            if not os.path.exists(outpath):
                print("ERROR: Output file was not created")
                return {'error': 'Generation failed - no output file created'}, 500
            
            output_size = os.path.getsize(outpath)
            print(f"Output file size: {output_size} bytes")
            
            # Compare input and output file sizes
            if input_size == output_size:
                print("WARNING: Input and output files are the same size - possible issue")
            
            with open(outpath, 'rb') as f:
                midi_data = f.read()
            
            print(f"Read {len(midi_data)} bytes from output file")
            
            # Cleanup
            try:
                os.unlink(inpath)
                os.unlink(outpath)
                print("Cleanup completed")
            except Exception as cleanup_error:
                print(f"Cleanup error: {cleanup_error}")
            
            model.close()
            print("Model closed")
            
            return Response(
                midi_data,
                mimetype="audio/midi",
                headers={"Content-Disposition": "attachment;filename=generated.mid"})
            
        except Exception as e:
            print(f"GENERATION ERROR: {str(e)}")
            import traceback
            traceback.print_exc()
            
            if 'inpath' in locals() and os.path.exists(inpath):
                os.unlink(inpath)
            if 'outpath' in locals() and os.path.exists(outpath):
                os.unlink(outpath)
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
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)