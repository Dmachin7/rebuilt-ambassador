import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { shiftsAPI } from '../../api/index.js';
import { getCurrentLocation } from '../../stubs/gps.js';
import { Card, Button, Badge, Spinner } from '../../components/ui/index.jsx';
import { formatShortDate, formatDateTime } from '../../utils/formatters.js';
import { Camera, MapPin, CheckCircle, Clock } from 'lucide-react';

export default function CheckIn() {
  const { shiftId } = useParams();
  const navigate = useNavigate();
  const [myShifts, setMyShifts] = useState([]);
  const [shift, setShift] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [locationStatus, setLocationStatus] = useState('idle'); // idle | checking | ok | error
  const [done, setDone] = useState(false);
  const fileRef = useRef(null);

  const loadShifts = async () => {
    const shifts = await shiftsAPI.list();
    setMyShifts(shifts);
    if (shiftId) {
      const found = shifts.find((s) => s.id === shiftId);
      setShift(found || null);
    }
    setLoading(false);
  };

  useEffect(() => { loadShifts(); }, [shiftId]);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleCheckin = async (targetShift) => {
    setChecking(true);
    setLocationStatus('checking');
    try {
      const gps = await getCurrentLocation();
      setLocationStatus('ok');

      const formData = new FormData();
      if (photo) formData.append('photo', photo);
      formData.append('lat', gps.lat);
      formData.append('lng', gps.lng);

      await shiftsAPI.checkin(targetShift.id, formData);
      setDone(true);
      setTimeout(() => navigate('/shifts'), 2000);
    } catch (err) {
      setLocationStatus('error');
      alert('Check-in failed: ' + err.message);
    } finally {
      setChecking(false);
    }
  };

  const handleCheckout = async (targetShift) => {
    if (!confirm('Ready to check out?')) return;
    setChecking(true);
    try {
      await shiftsAPI.checkout(targetShift.id);
      setDone(true);
      setTimeout(() => navigate(`/report/${targetShift.id}`), 1500);
    } catch (err) {
      alert('Checkout failed: ' + err.message);
    } finally {
      setChecking(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>;

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-20">
        <CheckCircle size={64} className="text-mint-400 mb-4" />
        <h2 className="text-xl font-bold text-slate-800 mb-2">All done!</h2>
        <p className="text-sm text-slate-500">Redirecting...</p>
      </div>
    );
  }

  const activeShift = myShifts.find((s) => s.status === 'CHECKED_IN');
  const targetShift = shift || activeShift;

  // No specific shift — let ambassador pick from their assigned shifts
  const assignedShifts = myShifts.filter((s) => s.status === 'ASSIGNED');

  if (!targetShift && assignedShifts.length === 0 && !activeShift) {
    return (
      <div className="px-4 py-8 max-w-lg mx-auto">
        <Card className="p-8 text-center">
          <p className="text-slate-500 mb-4">No active shift to check in to.</p>
          <Button onClick={() => navigate('/shifts')} variant="secondary">View My Shifts</Button>
        </Card>
      </div>
    );
  }

  if (!targetShift && assignedShifts.length > 0) {
    return (
      <div className="px-4 py-5 space-y-4 max-w-lg mx-auto">
        <h1 className="text-xl font-bold text-slate-800">Check In</h1>
        <p className="text-sm text-slate-500">Select a shift to check in to:</p>
        {assignedShifts.map((s) => (
          <Card key={s.id} className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setShift(s)}>
            <div className="font-medium text-slate-800">{s.event.title}</div>
            <div className="text-xs text-slate-500 mt-1">{formatShortDate(s.event.date)}</div>
          </Card>
        ))}
      </div>
    );
  }

  const isCheckedIn = targetShift?.status === 'CHECKED_IN';

  return (
    <div className="px-4 py-5 space-y-5 max-w-lg mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-800">{isCheckedIn ? 'Check Out' : 'Check In'}</h1>
        <p className="text-sm text-slate-500">Tap the button below to {isCheckedIn ? 'end your shift' : 'start your shift'}</p>
      </div>

      {/* Shift info */}
      <Card className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="font-semibold text-slate-800">{targetShift?.event.title}</div>
          <Badge status={targetShift?.status} />
        </div>
        <div className="space-y-1.5 text-xs text-slate-500">
          <div className="flex items-start gap-1.5"><MapPin size={12} className="mt-0.5 shrink-0" />{targetShift?.event.location}</div>
          <div className="flex items-center gap-1.5"><Clock size={12} />{formatShortDate(targetShift?.event.date)}</div>
          {isCheckedIn && targetShift?.checkinTime && (
            <div className="text-green-600 font-medium">Checked in at {formatDateTime(targetShift.checkinTime)}</div>
          )}
        </div>
      </Card>

      {/* GPS status */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700">📍 Location Check</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {locationStatus === 'idle' && 'Will verify when you check in'}
              {locationStatus === 'checking' && 'Verifying location...'}
              {locationStatus === 'ok' && '✅ Location verified (mock — always passes)'}
              {locationStatus === 'error' && '❌ Location error'}
            </p>
          </div>
          <div className={`w-3 h-3 rounded-full ${locationStatus === 'ok' ? 'bg-green-400' : locationStatus === 'error' ? 'bg-red-400' : 'bg-slate-200'}`} />
        </div>
        <p className="text-xs text-slate-300 mt-2">[STUB] GPS always passes. Real geofencing (300ft) will be added later.</p>
      </Card>

      {/* Photo upload — only for check-in */}
      {!isCheckedIn && (
        <Card className="p-4">
          <p className="text-sm font-medium text-slate-700 mb-2">📸 Booth Setup Photo</p>
          <p className="text-xs text-slate-400 mb-3">Optional — take a photo of your booth setup</p>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} className="hidden" />
          {photoPreview ? (
            <div className="relative">
              <img src={photoPreview} alt="Booth preview" className="w-full h-40 object-cover rounded-lg" />
              <button onClick={() => { setPhoto(null); setPhotoPreview(null); }} className="absolute top-2 right-2 bg-white rounded-full w-6 h-6 flex items-center justify-center text-slate-500 shadow text-sm">×</button>
            </div>
          ) : (
            <button onClick={() => fileRef.current.click()} className="w-full border-2 border-dashed border-slate-200 rounded-lg py-6 flex flex-col items-center gap-2 text-slate-400 hover:border-mint-300 hover:text-mint-500 transition-colors">
              <Camera size={24} />
              <span className="text-xs">Tap to add photo</span>
              <span className="text-xs text-slate-300">[STUB] Stored locally — Cloudinary/S3 not yet wired</span>
            </button>
          )}
        </Card>
      )}

      {/* Main action button */}
      {isCheckedIn ? (
        <Button
          onClick={() => handleCheckout(targetShift)}
          disabled={checking}
          className="w-full py-4 text-base bg-yellow-400 hover:bg-yellow-500 text-slate-800"
        >
          {checking ? 'Checking out...' : '🏁 Check Out — End Shift'}
        </Button>
      ) : (
        <Button
          onClick={() => handleCheckin(targetShift)}
          disabled={checking}
          className="w-full py-4 text-base"
        >
          {checking ? 'Checking in...' : '✅ Check In — Start Shift'}
        </Button>
      )}
    </div>
  );
}
