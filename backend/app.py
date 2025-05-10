from flask import Flask, request, jsonify
from remi.model import PopMusicTransformer
from converter.converter import process_midi_file

app = Flask(__name__)

# Route 1: Simple GET
@app.route('/hello', methods=['GET'])
def hello():
    return jsonify({'message': 'Hello, world!'})

@app.route('/sanitize_audio', methods=["POST"])
def sanitize():
    inpath = "" # Change later for wherever recording is stored
    outpath = "" # same as above
    process_midi_file(inpath, outpath)

# Route 2: Generate 
@app.route('/generate', methods=['POST'])
def generate():
    inpath = "" # Change later for wherever recording is stored
    outpath = "" # same as above

    model = PopMusicTransformer(
        checkpoint='REMI-tempo-checkpoint',
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
    
@app.route('/test', methods=['GET'])
def test():
    return jsonify({'message': "".join(["hello " for i in range(20)])})

if __name__ == '__main__':
    app.run(debug=True)

