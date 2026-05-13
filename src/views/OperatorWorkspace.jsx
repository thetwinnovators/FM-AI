import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function OperatorWorkspace() {
  const navigate = useNavigate()
  useEffect(() => { navigate('/operator/coding', { replace: true }) }, [navigate])
  return null
}
