import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { uid } from 'uid'
import { deleteEvent, getWorkouts, pushEvent, updateEvent, updateSeveralRows } from '@/composables/workouts'
import { workoutStore } from '@/stores/workout'
import { chosenDateStore } from '@/stores/chosenDate'
import { userIdFromStorage } from '@/composables/userIdFromStorage'
import { getProfileColumn, updateProfile } from '@/composables/profile'
import dayjs from 'dayjs'
import { BODY_PARAMS } from '@/constants/BODY_PARAMS.js'

export const useEventsStore = defineStore('userEvents', () => {
  const events = ref([])
  const favoritesFromBase = ref([])
  const bodyParams = ref(null)
  const activeBodyField = ref(0)
  const eventsLoading = ref(false)
  const copyObject = ref(null)
  const isCopyMode = ref(false)
  const workoutData = workoutStore()
  const dateStore = chosenDateStore()

  const fetchEventHandler = async () => {
    await getWorkouts(events, eventsLoading, userIdFromStorage())
    await getProfileColumn(
      favoritesFromBase,
      eventsLoading,
      'favorite_exercises'
    )

    await getProfileColumn(
      bodyParams,
      eventsLoading,
      'body_params'
    )
  }

  const deleteEventHandler = async (tableName, columnName, id) => {
    await deleteEvent(tableName, columnName, id, eventsLoading)
    events.value = events.value.filter(event => event.workoutId !== id)
  }

  const pushEventHandler = async () => {
    let workoutObject = {}

    if (copyObject.value) {
      const { title, color, exercisesParamsCollection, tonnage } = copyObject.value

      workoutObject = {
        workoutId: uid(50),
        date: dateStore.copyDate,
        title,
        color,
        exercisesParamsCollection,
        tonnage
      }

      await pushEvent(
        'workouts',
        workoutObject,
        eventsLoading
      )

      events.value.push(workoutObject)
      return
    }

    if (!workoutData.workoutId) return

    workoutObject = {
      title: workoutData.title,
      color: workoutData.color,
      date: dateStore.date,
      workoutId: workoutData.workoutId,
      exercisesParamsCollection: workoutData.exercisesParamsCollection,
      tonnage: workoutData.tonnage
    }

    await pushEvent(
      'workouts',
      workoutObject,
      eventsLoading
    )

    events.value.push(workoutObject)
  }

  const updateEventHandler = async () => {
    const workoutObject = {
      title: workoutData.title,
      color: workoutData.color,
      date: dateStore.date,
      exercisesParamsCollection: workoutData.exercisesParamsCollection,
      tonnage: workoutData.tonnage
    }

    await updateEvent(
      'workouts',
      'workoutId',
      workoutData.workoutId,
      workoutObject,
      eventsLoading
    )

    const index = events.value.findIndex(event => event.workoutId === workoutData.workoutId)

    if (index !== -1) {
      events.value.splice(index, 1, workoutObject)
    }
  }

  const updateAllEvents = async () => {
    await updateSeveralRows('workouts', events, eventsLoading)
  }

  const getExerciseSets = () => {
    const exerciseParams = workoutData.exercisesParamsCollection.find(item => item.exerciseId === workoutData.openedExerciseId)
    return exerciseParams ? (exerciseParams.sets ? exerciseParams.sets : []) : []
  }

  const previousResults = computed(() => {
    const userWorkouts = events.value.filter(workout => workout.date < dateStore.date)

    const previousSets = []
    for (const workout of userWorkouts.reverse()) {
      const exerciseParams = workout.exercisesParamsCollection.find(item => item.exerciseId === workoutData.openedExerciseId)

      if (exerciseParams && exerciseParams.sets?.length > 0) {
        previousSets.push(...exerciseParams.sets)
        break
      }
    }

    return previousSets
  })

  const combinedResults = computed(() => {
    const previous = previousResults.value.slice()
    const exerciseSets = getExerciseSets()

    const combined = exerciseSets.map((set, index) => {
      const prevSet = previous[index] || {}

      return {
        setId: set.setId,
        weight: set.weight,
        repeats: set.repeats,
        effort: set.effort,
        prevWeight: prevSet.weight ?? null,
        prevRepeats: prevSet.repeats ?? null,
        prevEffort: prevSet.effort ?? null
      }
    })

    combined.push(
      ...previous
        .slice(exerciseSets.length)
        .map(prevSet => ({
          setId: null,
          weight: null,
          repeats: null,
          effort: null,
          prevWeight: prevSet.weight,
          prevRepeats: prevSet.repeats,
          prevEffort: prevSet.effort
        }))
    )

    return combined
  })

  const rescheduleEvent = async (chosenEvent, isFutureEventsMove) => {
    if (isFutureEventsMove.value) {
      const eventsToUpdate = events.value.filter(event => event.date >= dateStore.date)

      eventsToUpdate.forEach(event => {
        event.date = event.date.add(dateStore.rescheduleCounter, 'day')
      })

      await updateAllEvents()

      return
    }
    workoutData.editUsersEvent(chosenEvent.value)
    dateStore.date = dateStore.rescheduledEventDate
    await updateEventHandler()
    workoutData.$reset()
  }

  const pushBodyParamsToBase = async (inputValue, activeParam, isLoading) => {
    const existingData = bodyParams.value.find(item => dayjs(item.date).isSame(dateStore.date, 'day'))

    if (existingData) {
      // Дата уже существует в массиве
      const hasExistingParam = existingData.params.some(param => param.label === activeParam.value.label)

      if (hasExistingParam) {
        // Параметр с таким label уже существует, обновим его значение
        existingData.params.find(param => param.label === activeParam.value.label).value = inputValue.value
      } else {
        // Параметр с таким label не существует, добавим новый объект параметра
        existingData.params.push({
          label: activeParam.value.label,
          value: inputValue.value
        })
      }
    } else {
      // Дата не существует в массиве, добавим новый объект данных
      const collectedData = {
        id: uid(15),
        date: dateStore.date,
        params: [{
          label: activeParam.value.label,
          value: inputValue.value
        }]
      }

      bodyParams.value.push(collectedData)
    }

    await updateProfile(
      null,
      isLoading,
      'body_params',
      bodyParams.value
    )
  }

  const activeParam = computed(() => BODY_PARAMS.find(param => param.id === activeBodyField.value))

  const filteredParamsByProp = computed(() => {
    // отфильтровали по типу (вес, рост итд)
    const resultArray = bodyParams.value?.filter(item => {
      return item.params.some(param => param.label === activeParam.value?.label)
    })

    return resultArray?.map(item => ({
      id: item.id,
      date: item.date,
      params: item.params.filter(param => param.label === activeParam.value?.label)
    }))
      .sort((a, b) => dayjs(b.date) - dayjs(a.date))
  })

  watch(() => dateStore.copyDate, async val => {
    if (val) {
      // if copyDate and copyObject is defined and filled
      await pushEventHandler()
      copyObject.value = null
      isCopyMode.value = false
      dateStore.copyDate = null
    }
  })

  watch(() => isCopyMode.value, async val => {
    if (!val) {
      copyObject.value = null
      isCopyMode.value = false
      dateStore.copyDate = null
    }
  })

  return {
    events,
    favoritesFromBase,
    bodyParams,
    activeBodyField,
    eventsLoading,
    copyObject,
    isCopyMode,
    fetchEventHandler,
    deleteEventHandler,
    pushEventHandler,
    updateEventHandler,
    previousResults,
    combinedResults,
    updateAllEvents,
    rescheduleEvent,
    pushBodyParamsToBase,
    filteredParamsByProp,
    activeParam
  }
})
