import { useState } from 'react'
import { ACHIEVEMENTS } from '../config/achievements'
import { useUserData } from '../contexts/UserDataContext'
import AchievementLabel from '../components/AchievementLabel'
import AchievementDetailsModal from '../components/AchievementDetailsModal'

export default function Achievements() {
  const { userData } = useUserData()
  const [selectedAchievement, setSelectedAchievement] = useState(null)
  const [selectedCount, setSelectedCount] = useState(0)

  const unlockedCount = Object.keys(userData?.achievements || {}).length
  const totalAchievements = ACHIEVEMENTS.length

  const handleAchievementClick = (achievement, count) => {
    setSelectedAchievement(achievement)
    setSelectedCount(count)
  }

  const handleCloseModal = () => {
    setSelectedAchievement(null)
    setSelectedCount(0)
  }

  return (
    <div className="space-y-6 pb-16">
      <div className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] px-6 py-7 shadow-[0_25px_60px_rgba(15,23,42,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: 'var(--muted)' }}>
          Achievements
        </p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight" style={{ color: 'var(--ink)' }}>
          Din Sladesh trofæhylde
        </h1>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
          Hver badge har en hemmelig udfordring. Du kan optjene dem gentagne gange – jo flere gange, jo bedre! Saml dem alle – eller prøv i det mindste at finde ud af, hvorfor vi synes de er sjove.
        </p>
        <div className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-[color:var(--line)] px-4 py-2 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          <span className="text-lg">🏅</span>
          {unlockedCount} / {totalAchievements} låst op
        </div>
      </div>

      <div className="space-y-4">
        {ACHIEVEMENTS.map((achievement) => {
          const achievementData = userData?.achievements?.[achievement.id]
          const unlocked = !!achievementData
          const count = achievementData?.count || 0
          return (
            <AchievementLabel 
              key={achievement.id} 
              achievement={achievement} 
              unlocked={unlocked} 
              count={count}
              onClick={unlocked ? () => handleAchievementClick(achievement, count) : undefined}
            />
          )
        })}
      </div>

      {selectedAchievement && (
        <AchievementDetailsModal
          achievement={selectedAchievement}
          count={selectedCount}
          onClose={handleCloseModal}
        />
      )}
    </div>
  )
}

