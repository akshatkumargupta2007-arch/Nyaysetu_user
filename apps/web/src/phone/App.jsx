import './index.css';
import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { auth } from '../shared/store.js';
import { TransitionProvider } from './components/Transition.jsx';
import Stage from './components/Stage.jsx';

import Language from './screens/Language.jsx';
import Voice from './screens/Voice.jsx';
import Home from './screens/Home.jsx';
import Speak from './screens/Speak.jsx';
import Photo from './screens/Photo.jsx';
import Where from './screens/Where.jsx';
import Send from './screens/Send.jsx';
import Phone from './screens/Phone.jsx';
import Code from './screens/Code.jsx';
import Sent from './screens/Sent.jsx';
import MyProblems from './screens/MyProblems.jsx';
import Status from './screens/Status.jsx';
import Fixed from './screens/Fixed.jsx';
import ReReport from './screens/ReReport.jsx';
import NeedsFix from './screens/NeedsFix.jsx';
import PhotoRejected from './screens/PhotoRejected.jsx';
import NotSent from './screens/NotSent.jsx';
import Privacy from './screens/Privacy.jsx';
import { ROUTES } from './routes.js';


// Flow: language -> phone -> OTP -> (AI voice) -> home -> complaint -> send.
// Nothing after the OTP screen opens without a login; a logged-in person skips phone/OTP.
function RequireLogin() {
  return auth.isLoggedIn() ? <Outlet /> : <Navigate to="/phone" replace />;
}
function PhoneGate() {
  return <Phone />;
}
function CodeGate() {
  return <Code />;
}

export default function App() {
  return (
    <TransitionProvider>
      <Stage>
        <Routes>
                    <Route path={ROUTES.language} element={<Language />} />
          <Route path={ROUTES.phone} element={<PhoneGate />} />
          <Route path={ROUTES.code} element={<CodeGate />} />
          <Route path={ROUTES.voice} element={<Voice />} />
          <Route element={<RequireLogin />}>
            <Route path={ROUTES.home} element={<Home />} />
            <Route path={ROUTES.speak} element={<Speak />} />
            <Route path={ROUTES.photo} element={<Photo />} />
            <Route path={ROUTES.where} element={<Where />} />
            <Route path={ROUTES.send} element={<Send />} />
            <Route path={ROUTES.sent} element={<Sent />} />
            <Route path={ROUTES.problems} element={<MyProblems />} />
            <Route path={ROUTES.status} element={<Status />} />
            <Route path={ROUTES.fixed} element={<Fixed />} />
            <Route path={ROUTES.reReport} element={<ReReport />} />
            <Route path={ROUTES.needsFix} element={<NeedsFix />} />
            <Route path={ROUTES.photoRejected} element={<PhotoRejected />} />
            <Route path={ROUTES.notSent} element={<NotSent />} />
            <Route path={ROUTES.privacy} element={<Privacy />} />
          </Route>
          <Route path="*" element={<Navigate to={ROUTES.language} replace />} />
        </Routes>
      </Stage>
    </TransitionProvider>
  );
}
