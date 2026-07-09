import {
  Droplet,
  Droplets,
  Sparkles,
  Waves,
  Gem,
  TestTube,
  Eye,
  FlaskConical,
  Zap,
  Cloud,
  Target,
  Sun,
  SprayCan,
  Smile,
  Square,
  Layers,
  CircleDot,
} from 'lucide-react'

export const CATEGORIES = [
  { value: 'CLEANSER', label: 'Cleanser', icon: Droplet },
  { value: 'CLEANSING_BALM_OIL', label: 'Cleansing Balm / Oil', icon: Droplets },
  { value: 'EXFOLIANT', label: 'Exfoliant', icon: Sparkles },
  { value: 'TONER', label: 'Toner', icon: Waves },
  { value: 'ESSENCE', label: 'Essence', icon: Gem },
  { value: 'AMPOULE', label: 'Ampoule', icon: TestTube },
  { value: 'EYE_CREAM', label: 'Eye Cream', icon: Eye },
  { value: 'SERUM', label: 'Serum', icon: FlaskConical },
  { value: 'ACTIVE', label: 'Active', icon: Zap },
  { value: 'MOISTURISER', label: 'Moisturiser', icon: Cloud },
  { value: 'SPOT_TREATMENT', label: 'Spot Treatment', icon: Target },
  { value: 'SPF', label: 'SPF', icon: Sun },
  { value: 'FACIAL_MIST', label: 'Facial Spray / Mist', icon: SprayCan },
  { value: 'LIP_TREATMENT', label: 'Lip Treatment / Mask', icon: Smile },
  { value: 'FACE_MASK', label: 'Face Mask', icon: Square },
  { value: 'SHEET_MASK', label: 'Sheet Mask', icon: Layers },
  { value: 'EYE_PATCHES', label: 'Eye Patches', icon: CircleDot },
]

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.value, c]))

export const FILL_LEVELS = [
  { value: 100, label: 'Full' },
  { value: 75, label: '75%' },
  { value: 50, label: '50%' },
  { value: 25, label: '25%' },
]

export const TIME_OF_DAY_OPTIONS = [
  { value: 'AM', label: 'Morning' },
  { value: 'PM', label: 'Evening' },
  { value: 'BOTH', label: 'Both' },
]
