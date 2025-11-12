import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-primary-50 to-primary-100 flex flex-col items-center justify-center text-center px-6">
      <div className="max-w-4xl mx-auto">
        {/* Title */}
        <h1 className="text-6xl md:text-7xl font-bold text-gradient mb-6 leading-tight">
          ColdConnect
        </h1>
        <div className="w-24 h-1 bg-gradient-to-r from-primary-600 to-primary-800 mx-auto rounded-full mb-8"></div>
        
        {/* Subtitle */}
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8 leading-relaxed max-w-3xl mx-auto">
          Turn cold emails into warm opportunities
        </h2>
        
        {/* Description */}
        <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
          Elevate your outreach game with intelligent email generation
        </p>

        {/* CTA Button */}
        <div className="mb-8">
          <Link
            to="/generate"
            className="btn-primary inline-block text-lg"
          >
            Start Generating
          </Link>
        </div>
        
        {/* Features */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-8 text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-primary-600 rounded-full"></div>
            <span className="text-sm font-medium">AI-Powered</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-primary-600 rounded-full"></div>
            <span className="text-sm font-medium">Professional</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-primary-600 rounded-full"></div>
            <span className="text-sm font-medium">Personalized</span>
          </div>
        </div>
      </div>
    </div>
  )
}
