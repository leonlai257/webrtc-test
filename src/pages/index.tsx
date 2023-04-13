import Head from 'next/head'
import styles from '@/styles/Home.module.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as io from 'socket.io-client'

export default function Home() {
    let localStream: MediaStream
    let localVideo: HTMLVideoElement
    let remoteVideo: HTMLVideoElement

    let pc1: RTCPeerConnection | null
    let pc2: RTCPeerConnection | null
    const offerOptions = {
        offerToReceiveAudio: 1,
        offerToReceiveVideo: 1,
    }

    function getName(pc: RTCPeerConnection) {
        return pc === pc1 ? 'pc1' : 'pc2'
    }

    function getOtherPc(pc: RTCPeerConnection) {
        return pc === pc1 ? pc2 : pc1
    }

    async function start() {
        console.log('Requesting local stream')
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
            console.log('Received local stream')
            localVideo.srcObject = stream
            localStream = stream
        } catch (e) {
            alert(`getUserMedia() error: ${e.name}`)
        }
    }

    async function call() {
        console.log('Starting call')
        const videoTracks = localStream.getVideoTracks()
        const audioTracks = localStream.getAudioTracks()
        if (videoTracks.length > 0) {
            console.log(`Using video device: ${videoTracks[0].label}`)
        }
        if (audioTracks.length > 0) {
            console.log(`Using audio device: ${audioTracks[0].label}`)
        }
        const configuration = {}
        console.log('RTCPeerConnection configuration:', configuration)
        pc1 = new RTCPeerConnection(configuration)
        console.log('Created local peer connection object pc1')
        pc1.addEventListener('icecandidate', (e) => onIceCandidate(pc1 as RTCPeerConnection, e))
        pc2 = new RTCPeerConnection(configuration)
        console.log('Created remote peer connection object pc2')
        pc2.addEventListener('icecandidate', (e) => onIceCandidate(pc2 as RTCPeerConnection, e))
        pc1.addEventListener('iceconnectionstatechange', (e) => onIceStateChange(pc1 as RTCPeerConnection, e))
        pc2.addEventListener('iceconnectionstatechange', (e) => onIceStateChange(pc2 as RTCPeerConnection, e))
        pc2.addEventListener('track', gotRemoteStream)

        localStream.getTracks().forEach((track) => pc1?.addTrack(track, localStream))
        console.log('Added local stream to pc1')

        try {
            console.log('pc1 createOffer start')
            const offer = await pc1.createOffer(offerOptions)
            await onCreateOfferSuccess(offer)
        } catch (error: any) {
            console.log(`Failed to create session description: ${error.toString()}`)
        }
    }

    async function onCreateOfferSuccess(desc) {
        console.log(`Offer from pc1\n${desc.sdp}`)
        console.log('pc1 setLocalDescription start')
        try {
            await pc1?.setLocalDescription(desc)
            onSetLocalSuccess(pc1 as RTCPeerConnection)
        } catch (error: any) {
            console.log(`Failed to set session description: ${error.toString()}`)
        }

        console.log('pc2 setRemoteDescription start')
        try {
            await pc2?.setRemoteDescription(desc)
            onSetRemoteSuccess(pc2 as RTCPeerConnection)
        } catch (error: any) {
            console.log(`Failed to set session description: ${error.toString()}`)
        }

        try {
            const answer = await pc2?.createAnswer()
            await onCreateAnswerSuccess(answer)
        } catch (error: any) {
            console.log(`Failed to set session description: ${error.toString()}`)
        }
    }

    function onSetLocalSuccess(pc: RTCPeerConnection) {
        console.log(`${getName(pc)} setLocalDescription complete`)
    }

    function onSetRemoteSuccess(pc: RTCPeerConnection) {
        console.log(`${getName(pc)} setRemoteDescription complete`)
    }

    function gotRemoteStream(e) {
        if (remoteVideo.srcObject !== e.streams[0]) {
            remoteVideo.srcObject = e.streams[0]
            console.log('pc2 received remote stream')
        }
    }

    async function onCreateAnswerSuccess(desc) {
        console.log(`Answer from pc2:\n${desc.sdp}`)
        console.log('pc2 setLocalDescription start')
        try {
            await pc2.setLocalDescription(desc)
            onSetLocalSuccess(pc2)
        } catch (error: any) {
            console.log(`Failed to set session description: ${error.toString()}`)
        }
        console.log('pc1 setRemoteDescription start')
        try {
            await pc1.setRemoteDescription(desc)
            onSetRemoteSuccess(pc1)
        } catch (error: any) {
            console.log(`Failed to set session description: ${error.toString()}`)
        }
    }

    async function onIceCandidate(pc: RTCPeerConnection, event) {
        try {
            await getOtherPc(pc).addIceCandidate(event.candidate)
            onAddIceCandidateSuccess(pc)
        } catch (e) {
            onAddIceCandidateError(pc, e)
        }
        console.log(`${getName(pc)} ICE candidate:\n${event.candidate ? event.candidate.candidate : '(null)'}`)
    }

    function onAddIceCandidateSuccess(pc: RTCPeerConnection) {
        console.log(`${getName(pc)} addIceCandidate success`)
    }

    function onAddIceCandidateError(pc: RTCPeerConnection, error: any) {
        console.log(`${getName(pc)} failed to add ICE Candidate: ${error.toString()}`)
    }

    function onIceStateChange(pc: RTCPeerConnection, event: any) {
        if (pc) {
            console.log(`${getName(pc)} ICE state: ${pc.iceConnectionState}`)
            console.log('ICE state change event: ', event)
        }
    }

    function hangup() {
        console.log('Ending call')
        pc1.close()
        pc2.close()
        pc1 = null
        pc2 = null
    }

    useEffect(() => {
        const navigator = window.navigator
        localVideo = document.getElementById('localVideo') as HTMLVideoElement
        remoteVideo = document.getElementById('remoteVideo') as HTMLVideoElement

        // navigator.mediaDevices
        //     .getUserMedia({ audio: true, video: true })
        //     .then((stream) => {
        //         localVideo.srcObject = stream
        //         localVideo.onloadedmetadata = () => {
        //             localVideo.play()
        //         }
        //     })
        //     .catch((err) => {
        //         console.log(err)
        //     })
    })

    return (
        <>
            <Head>
                <title>Create Next App</title>
                <meta name="description" content="Generated by create next app" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="icon" href="/favicon.ico" />
            </Head>
            <main className={styles.main}>
                <video id="localVideo" playsInline autoPlay muted></video>
                <video id="remoteVideo" playsInline autoPlay></video>
                <div>
                    <button id="startButton" onClick={start}>
                        Start
                    </button>
                    <button id="callButton" onClick={call}>
                        Call
                    </button>
                    <button id="hangupButton" onClick={hangup}>
                        Hang Up
                    </button>
                </div>
            </main>
        </>
    )
}
