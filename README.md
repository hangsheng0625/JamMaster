# JamMaster 🎹🎵

**AI-Powered Music Generation Web Application**

JamMaster is an innovative web application that leverages advanced deep learning to generate expressive piano music. Built on the foundation of the REMI (REvamped MIDI-derived events) Transformer model, this project creates a seamless bridge between cutting-edge AI music generation and user-friendly web interfaces.

## 🎯 Project Overview

JamMaster transforms music creation by allowing users to generate sophisticated piano compositions through two intuitive input methods:
- **MIDI File Upload**: Users can upload existing MIDI files to generate continuations or variations
- **Virtual Piano Interface**: Interactive piano keyboard for real-time composition and generation

The application combines the power of the REMI Pop Music Transformer model with a modern web stack to deliver an accessible and engaging music creation experience.

## 🏗️ Architecture

### Core Components

**Deep Learning Engine**
- **REMI Model**: Advanced Transformer-XL architecture trained on pop piano compositions
- **Event Representation**: Novel MIDI-to-text conversion providing metrical context for rhythmic patterns
- **Generation Capabilities**: Produces minute-long compositions with coherent rhythm, harmony, and structure

**Frontend (React)**
- Interactive virtual piano interface
- MIDI file upload and management
- Real-time music playback and visualization
- Modern, responsive user interface

**Backend (Flask)**
- RESTful API for music generation requests
- MIDI file processing and validation
- Integration with REMI model inference
- Response formatting and optimization

### Technology Stack

- **Frontend**: React.js, Lucide React (icons), ML5.js (machine learning utilities)
- **Backend**: Flask (Python web framework)
- **AI Model**: REMI Transformer-XL (TensorFlow 1.14)
- **Data Processing**: MIDIToolkit, SciPy
- **Environment**: Conda (Python 3.6), Node.js/npm

## 🚀 Installation Guide

### Prerequisites

Ensure you have the following installed on your system:
- **Node.js** (v14 or higher) and **npm**/**pnpm**
- **Anaconda** or **Miniconda**
- **Git**

### Step 1: Clone the Repository

```bash
git clone https://github.com/hangsheng0625/JamMaster.git
cd JamMaster
```

### Step 2: Frontend Setup

Install the required Node.js dependencies:

```bash
# Using pnpm (recommended)
pnpm install lucide-react
npm install ml5
npm install -D patch-package

# Alternative using npm
npm install lucide-react ml5
npm install -D patch-package
```

### Step 3: AI Model Environment Setup

The REMI model requires a specific Python environment with older dependencies for compatibility:

```bash
# Create isolated conda environment
conda create -n tf114_env python=3.6
conda activate tf114_env

# Navigate to the REMI model directory
cd remi

# Install required Python packages
pip install tensorflow==1.14.0
pip install miditoolkit
pip install scipy
```

### Step 4: Verify Installation

Test the model setup:

```bash
# Ensure you're in the remi directory with activated environment
conda activate tf114_env
python main.py
```

## 🎮 Usage Instructions

### Starting the Application

**Backend (Flask Server)**
```bash
# Navigate to backend directory and activate conda environment
cd backend
conda activate tf114_env
python app.py
```

**Frontend (React Application)**
```bash
# Navigate to frontend directory in a new terminal
cd frontend
npm start
# or
pnpm start
```

### Using JamMaster

**Virtual Piano Mode**
1. Access the virtual piano interface through the web application
2. Play notes using your mouse or keyboard
3. Record your composition
4. Click "Generate" to create AI-powered continuations

**MIDI Upload Mode**
1. Click the "Upload MIDI" button
2. Select a MIDI file from your computer
3. Choose generation parameters (length, temperature, etc.)
4. Generate new compositions based on your input

**Generation Parameters**
- **Target Bars**: Number of musical bars to generate (recommended: 8-32)
- **Temperature**: Controls creativity vs. coherence (0.8-1.5 recommended)
- **Top-K**: Limits vocabulary for more focused generation (3-10 recommended)

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the backend directory:

```env
# Flask Configuration
FLASK_ENV=development
FLASK_DEBUG=True
PORT=5000

# REMI Model Configuration
MODEL_CHECKPOINT_PATH=./remi/checkpoints/
CUDA_VISIBLE_DEVICES=0  # Set to -1 for CPU-only mode
```

### Model Checkpoints

Download the pre-trained REMI checkpoints:
1. Visit the [REMI repository](https://github.com/YatingMusic/remi)
2. Download the checkpoint files
3. Place them in the `remi/checkpoints/` directory

## 🎼 Technical Details

### REMI Model Architecture

The REMI (REvamped MIDI-derived events) model represents a significant advancement in AI music generation:

**Event Representation Innovation**
- Converts MIDI into text-like discrete tokens
- Provides metrical context for rhythmic pattern modeling
- Enables generation without post-processing refinement

**Transformer-XL Foundation**
- Extended attention mechanisms for long-term dependencies
- Optimized for sequential music data
- Supports controllable tempo and chord progression

**Generation Capabilities**
- Produces coherent musical structures
- Maintains harmonic consistency
- Generates expressive timing variations

### API Endpoints

**POST /generate**
```json
{
  "midi_data": "base64_encoded_midi",
  "n_target_bar": 16,
  "temperature": 1.2,
  "topk": 5
}
```

**POST /upload**
```json
{
  "file": "midi_file_upload"
}
```

## 🛠️ Development

### Project Structure

```
JamMaster/
├── frontend/                 # React application
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── utils/          # Utility functions
│   │   └── styles/         # CSS/styling
│   └── package.json
├── backend/                 # Flask application
│   ├── app.py              # Main Flask application
│   ├── models/             # Model integration
│   └── utils/              # Backend utilities
├── remi/                   # REMI model implementation
│   ├── model.py            # Model architecture
│   ├── main.py             # Example usage
│   └── checkpoints/        # Pre-trained weights
└── README.md
```

### Contributing

We welcome contributions to improve JamMaster:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** and test thoroughly
4. **Commit with clear messages**: `git commit -m 'Add amazing feature'`
5. **Push to your branch**: `git push origin feature/amazing-feature`
6. **Open a Pull Request**

### Development Guidelines

- Follow React best practices for frontend development
- Use Flask conventions for backend API design
- Maintain compatibility with TensorFlow 1.14 for model integration
- Add comprehensive error handling for user inputs
- Include unit tests for new functionality

## 🚨 Troubleshooting

### Common Issues

**Model Loading Errors**
- Verify conda environment activation: `conda activate tf114_env`
- Check TensorFlow version: `python -c "import tensorflow; print(tensorflow.__version__)"`
- Ensure checkpoint files are properly downloaded

**Frontend Build Issues**
- Clear node modules: `rm -rf node_modules && npm install`
- Check Node.js version compatibility
- Verify all dependencies are installed

**MIDI Processing Problems**
- Validate MIDI file format (Type 0 or Type 1)
- Check file size limits (recommended < 1MB)
- Ensure proper file encoding

### Performance Optimization

**For Better Generation Speed**
- Use GPU acceleration when available
- Reduce target bar count for faster generation
- Optimize temperature and top-k parameters

**For Memory Management**
- Monitor RAM usage during generation
- Close model sessions properly
- Implement batch processing for multiple requests

## 📚 Additional Resources

### Academic Background

This project builds upon the research presented in:
- **Paper**: "Pop Music Transformer: Beat-based Modeling and Generation of Expressive Pop Piano Compositions" (ACM Multimedia 2020)
- **Authors**: Yu-Siang Huang, Yi-Hsuan Yang
- **arXiv**: https://arxiv.org/abs/2002.00212

### Related Projects

- **Original REMI Repository**: https://github.com/YatingMusic/remi
- **MIDIToolkit**: https://github.com/YatingMusic/miditoolkit
- **Transformer-XL**: https://github.com/kimiyoung/transformer-xl

### Community

- **Issues**: Report bugs and request features via GitHub Issues
- **Discussions**: Join conversations about AI music generation
- **Documentation**: Contribute to improving user guides and tutorials

## 📄 License

This project is built upon the REMI model and incorporates various open-source components. Please refer to individual component licenses for specific terms and conditions.

## 🙏 Acknowledgments

- **REMI Team**: Yu-Siang Huang and Yi-Hsuan Yang for the foundational AI model
- **Transformer-XL**: kimiyoung for the transformer architecture
- **Community**: Contributors and testers who help improve JamMaster

---

**Ready to create your next musical masterpiece? Start jamming with JamMaster today! 🎵**
