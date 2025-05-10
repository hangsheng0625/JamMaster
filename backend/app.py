from flask import Flask, request, jsonify

app = Flask(__name__)

# Route 1: Simple GET
@app.route('/hello', methods=['GET'])
def hello():
    return jsonify({'message': 'Hello, world!'})

# Route 2: POST with JSON input
@app.route('/add', methods=['POST'])
def add_numbers():
    data = request.get_json()
    if not data or 'a' not in data or 'b' not in data:
        return jsonify({'error': 'Missing "a" or "b" in request'}), 400

    try:
        a = int(data['a'])
        b = int(data['b'])
        return jsonify({'result': a + b})
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid input. "a" and "b" must be integers'}), 400

if __name__ == '__main__':
    app.run(debug=True)

