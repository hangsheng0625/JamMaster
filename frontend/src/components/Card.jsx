import robot from "../assets/robot.png"
import recordingIcon from "../assets/recording_icon.png"
import piano from "../assets/piano.png"
export default function Card(){
    return (
        <main>
            <h1>Virtual Piano Studio</h1>
            <p>Play, record, and let AI enhance your music</p>
            <img src={robot} className="robot"/>
            <button type="button" className="recording-button"><img src={recordingIcon}/>Start Recording</button>
            <img src={piano} className="piano"/>
        </main>
    )
}