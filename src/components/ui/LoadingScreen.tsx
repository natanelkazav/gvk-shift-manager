interface LoadingScreenProps {
  message?: string;
}

function LoadingScreen({
  message = 'טוען את המערכת...',
}: LoadingScreenProps) {
  return (
    <div
      className="loading-screen"
      role="status"
      aria-live="polite"
    >
      <div
        className="loading-spinner"
        aria-hidden="true"
      />

      <p>{message}</p>
    </div>
  );
}

export default LoadingScreen;