package com.tausib.springjobportal.aop;


import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
@Aspect
public class ValidationAspect {

    private static final Logger LOGGER = LoggerFactory.getLogger(ValidationAspect.class);

    @Around("execution(* com.tausib.springjobportal.service.JobService.updateJob(..)) && args(postid)")
    public Object validationAndUpdate(ProceedingJoinPoint pjp, int postid) throws Throwable{
        if (postid<0){
            LOGGER.info("Post id id Negative, Updateing it");
            postid = -postid;
            LOGGER.info("New Value of post id is " + postid);
        }
        Object obj = pjp.proceed(new Object[]{postid});
        return obj;
    }

    }
